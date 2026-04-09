-- ========================================
-- LAYER 4: PERFORMANCE ANALYZER VERIFICATION
-- Business: Café Faust (840347de-9ba7-4275-8aa3-4553417fc2af)
-- ========================================

-- Layer 4 should analyze historical post performance to:
-- 1. Identify what content types perform best
-- 2. Adjust distribution based on performance
-- 3. Learn from past successes/failures
-- 4. Track engagement patterns

-- Q1: Check if there's a posts/content performance table
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%post%' OR table_name LIKE '%content%' OR table_name LIKE '%performance%' OR table_name LIKE '%engagement%')
ORDER BY table_name;

-- Q2: Check content_type_baselines table (Layer 2 reference)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'content_type_baselines'
ORDER BY ordinal_position;

-- Q3: Check if Café Faust has any performance baselines
SELECT 
  business_id,
  total_posts_analyzed,
  sufficient_data,
  overall_avg_engagement_rate,
  overall_avg_reach,
  last_calculated,
  baselines
FROM content_type_baselines
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Q4: Check for any historical post data
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND (column_name LIKE '%engagement%' OR column_name LIKE '%reach%' OR column_name LIKE '%likes%' OR column_name LIKE '%comments%')
ORDER BY table_name, column_name;

-- Q5: Look for opportunity_tracking table (mentioned in compound-opportunities.ts)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'opportunity_tracking'
ORDER BY ordinal_position;

-- ========================================
-- Layer 4 may be a stub (no historical data yet)
-- Need to check if RPC function exists: get_performance_adjusted_distribution
-- ========================================

-- Q6: Check if RPC function exists in database
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname LIKE '%performance%' OR proname LIKE '%distribution%'
ORDER BY proname;

-- Q7: Check content_performance_log structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'content_performance_log'
ORDER BY ordinal_position;

-- Q8: Check if ANY posts have been logged (any business)
SELECT 
  COUNT(*) as total_posts_logged,
  COUNT(DISTINCT business_id) as businesses_with_data
FROM content_performance_log;

-- Q9: Check if Café Faust has any performance logs
SELECT 
  posted_at,
  content_type,
  platform,
  reach,
  engagement_total,
  likes,
  comments
FROM content_performance_log
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY posted_at DESC
LIMIT 10;

-- Q10: Check get_performance_adjusted_distribution logic threshold
-- (The function checks sufficient_data flag, which requires >= 20 posts)

-- ========================================
-- LAYER 4 VERIFICATION RESULTS
-- ========================================
-- 
-- ✅ LAYER 4 FULLY IMPLEMENTED BUT INACTIVE (COLD START)
--
-- FINDINGS:
-- 1. INFRASTRUCTURE: ✅ Complete
--    - content_performance_log: 34 columns tracking all metrics
--    - content_type_baselines: JSONB storage for learned patterns
--    - opportunity_tracking: Prevents duplicate events
--    - RPC functions: get_performance_adjusted_distribution, log_post_performance
--
-- 2. DATA STATUS: ❌ Zero posts logged
--    - Q8: 0 posts across ALL businesses
--    - Q9: Café Faust has 0 performance logs
--    - Q3: No baselines calculated (sufficient_data = NULL)
--
-- 3. COLD START BEHAVIOR: ✅ Working as designed
--    - RPC function checks: "IF NOT FOUND OR NOT v_baselines.sufficient_data"
--    - Falls back to Layer 2 defaults (hardcoded 7 slots)
--    - Requires 20+ posts before activating performance optimization
--
-- 4. ACTIVATION REQUIREMENTS:
--    - Publish posts via weekly_content_plans
--    - Integrate Instagram/Facebook API to fetch metrics
--    - Call log_post_performance() after fetching
--    - After 20+ posts: sufficient_data becomes TRUE
--    - Then: get_performance_adjusted_distribution() starts optimizing
--
-- 5. SCHEMA RICHNESS:
--    - Tracks: reach, impressions, likes, comments, shares, saves, clicks
--    - Context: menu_items_featured, location_hooks, weather_condition, seasonal_context
--    - Meta: was_ai_generated, user_edited, user_rating, visual_style
--    - Time: post_time, post_day_of_week (for best posting time analysis)
--
-- RESULT: Layer 4 is READY but waiting for first posts to be published
-- No bugs found - graceful cold start fallback working correctly
-- ========================================
