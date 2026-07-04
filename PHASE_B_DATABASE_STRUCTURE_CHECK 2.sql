-- TEST: Verify database structure for Phase B (Tracking)
-- Check if weekly_content_plans table has the required structure

-- 1. Check if weekly_content_plans table exists
SELECT 
  'weekly_content_plans exists' as check_name,
  COUNT(*) as table_count
FROM information_schema.tables
WHERE table_name = 'weekly_content_plans'
  AND table_schema = 'public';

-- 2. Check columns in weekly_content_plans
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'weekly_content_plans'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check if posts column exists and is JSONB
SELECT 
  'posts column type' as check_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'weekly_content_plans'
  AND column_name = 'posts'
  AND table_schema = 'public';

-- 4. Check sample posts structure (if any data exists)
SELECT 
  'Sample posts structure' as info,
  business_id,
  week_start_date,
  created_at,
  jsonb_typeof(posts) as posts_type,
  jsonb_array_length(posts) as posts_count
FROM weekly_content_plans
WHERE posts IS NOT NULL
LIMIT 5;

-- 5. Check if any posts have content_type field (should be 0 initially)
SELECT 
  'Posts with content_type' as check_name,
  COUNT(*) as count
FROM weekly_content_plans,
  jsonb_array_elements(posts) as post
WHERE post->>'content_type' IS NOT NULL;

-- 6. Test the staleness query (what tracking module will run)
-- This simulates: gte('week_start_date', lookbackDate)
SELECT 
  'Simulated staleness query' as info,
  COUNT(*) as plans_count,
  COUNT(DISTINCT business_id) as business_count
FROM weekly_content_plans
WHERE week_start_date >= CURRENT_DATE - INTERVAL '8 weeks';

-- 7. Test the drift query (what tracking module will run)
SELECT 
  'Simulated drift query' as info,
  COUNT(*) as plans_count
FROM weekly_content_plans
WHERE week_start_date >= CURRENT_DATE - INTERVAL '8 weeks';

-- 8. Check for Cafe Faust data specifically
SELECT 
  'Cafe Faust weekly plans' as check_name,
  COUNT(*) as plan_count,
  MIN(week_start_date) as earliest_week,
  MAX(week_start_date) as latest_week
FROM weekly_content_plans
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 9. Verify tracking module won't break on empty data
SELECT 
  'Empty result simulation' as test_name,
  COALESCE(jsonb_array_length('[]'::jsonb), 0) as array_length,
  '[]'::jsonb as empty_array;
