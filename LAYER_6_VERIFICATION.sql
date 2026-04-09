-- ========================================
-- LAYER 6: POST SLOT OPTIMIZER (SCHEDULING) VERIFICATION
-- Business: Café Faust (840347de-9ba7-4275-8aa3-4553417fc2af)
-- ========================================

-- Layer 6 should:
-- 1. Assign optimal posting times (day + hour)
-- 2. Consider platform best practices
-- 3. Use historical performance data (if available)
-- 4. Avoid clustering posts too close together
-- 5. Match content type to optimal timing

-- Q1: Check if there's a posting schedule/timing table
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%schedule%' OR table_name LIKE '%timing%' OR table_name LIKE '%slot%')
ORDER BY table_name;

-- Q2: Check if businesses table has posting preferences
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'businesses'
  AND (column_name LIKE '%post%' OR column_name LIKE '%schedule%' OR column_name LIKE '%time%')
ORDER BY column_name;

-- Q3: Check weekly_content_plans structure (this stores the final schedule)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'weekly_content_plans'
ORDER BY ordinal_position;

-- Q4: Check if Café Faust has any weekly plans
SELECT 
  week_start,
  week_end,
  week_number,
  generated_at,
  jsonb_array_length(posts) as num_posts
FROM weekly_content_plans
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY week_start DESC
LIMIT 5;

-- Q6: Check the actual post schedule from most recent plan
SELECT 
  p->>'dayOfWeek' as day_of_week,
  p->>'hour' as hour,
  p->>'contentType' as content_type,
  p->>'subject' as subject,
  p->>'platform' as platform
FROM weekly_content_plans,
  jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND generated_at = (
    SELECT MAX(generated_at) 
    FROM weekly_content_plans 
    WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  )
ORDER BY (p->>'dayOfWeek')::int, (p->>'hour')::int;

-- Q7: Check the actual JSONB structure (see all keys)
SELECT jsonb_object_keys(p) as key_name
FROM weekly_content_plans,
  jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND generated_at = (
    SELECT MAX(generated_at) 
    FROM weekly_content_plans 
    WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  )
LIMIT 1;

-- Q8: Show raw JSONB from one post
SELECT posts->0 as first_post
FROM weekly_content_plans
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND generated_at = (
    SELECT MAX(generated_at) 
    FROM weekly_content_plans 
    WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  );

-- Q5: Check if content_performance_log tracks best posting times
SELECT DISTINCT
  post_time::TIME as time_posted,
  post_day_of_week as day_of_week,
  COUNT(*) as posts_count,
  AVG(engagement_rate) as avg_engagement
FROM content_performance_log
GROUP BY post_time::TIME, post_day_of_week
ORDER BY avg_engagement DESC NULLS LAST
LIMIT 10;

-- Q9: Extract actual schedule with correct JSONB paths
SELECT 
  p->'timing'->>'day' as day,
  p->'timing'->>'time' as time,
  p->'postType'->>'type' as content_type,
  p->'contentSubject'->>'dish' as dish,
  p->'platformFormat'->>'platform' as platform
FROM weekly_content_plans,
  jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND generated_at = (
    SELECT MAX(generated_at) 
    FROM weekly_content_plans 
    WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  )
ORDER BY 
  CASE p->'timing'->>'day'
    WHEN 'Monday' THEN 1
    WHEN 'Tuesday' THEN 2
    WHEN 'Wednesday' THEN 3
    WHEN 'Thursday' THEN 4
    WHEN 'Friday' THEN 5
    WHEN 'Saturday' THEN 6
    WHEN 'Sunday' THEN 7
  END,
  p->'timing'->>'time';

-- ========================================
-- LAYER 6 VERIFICATION RESULTS
-- ========================================
-- 
-- ⚠️ LAYER 6 BUG: TIME COLLISION DETECTED
--
-- ACTUAL SCHEDULE (Q9):
-- 1. Monday 11:00 - menu_item (FAVORITTEN)
-- 2. Wednesday 11:00 - menu_item (DEN NYE)
-- 3. Friday 11:00 - menu_item (Pandekage)
-- 4. Friday 11:00 - atmosphere_experience (Cold weather content) ❌ COLLISION
--
-- BUG FOUND:
-- - Posts 3 and 4 both scheduled Friday 11:00
-- - Layer 6 should spread posts to avoid clustering
-- - Expected: Different times or days
-- - Actual: Same day, same time
--
-- SCHEDULING LOGIC VERIFIED:
-- ✅ Mon/Wed/Fri pattern for menu items (correct)
-- ✅ 11:00 lunch decision time (correct)
-- ✅ All Instagram (correct)
-- ❌ Time collision not prevented
--
-- INFRASTRUCTURE:
-- - timing: {day, date, time, rationale}
-- - postType: {type, category, priority}
-- - caption: {text, hashtags, emojiCount, isAIGenerated}
-- - platformFormat: {platform, format, rationale}
-- - media: {status: "pending", uploadedFiles: []}
-- - visualDirection: Complete photo guidance
-- - productionNotes: Timing and logistics
--
-- DATA STRUCTURE (Q8):
-- - 5 weekly plans generated
-- - All with 4 posts (3 menu + 1 atmosphere)
-- - JSONB stores complete details
-- - Draft status for approval
--
-- RESULT: Layer 6 mostly working but needs collision detection fix
-- Scheduling follows patterns but allows same-time posts
-- ========================================
