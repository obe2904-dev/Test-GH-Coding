-- _TEST_QUICK_SUGGESTIONS_INTEGRATION.sql
-- Verification tests for get-quick-suggestions rotation queue integration
-- Run AFTER deploying the updated function

-- Test 1: Verify rotation queue returns dishes for Cafe Faust
-- Expected: At least 1 dish from menu_items_normalized
SELECT 
  'Test 1: Rotation Queue Available' as test_name,
  COUNT(*) as dish_count,
  STRING_AGG(item_name, ', ' ORDER BY item_name) as sample_dishes
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid
  AND service_periods IS NOT NULL;

-- Test 2: Verify service period detection has programme data
-- Expected: 3 programmes (Brunch, FROKOST, AFTEN) with time_windows
SELECT 
  'Test 2: Service Period Configuration' as test_name,
  COUNT(*) as programme_count,
  STRING_AGG(programme_name || ': ' || time_windows::text, '; ' ORDER BY programme_name) as programmes
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid;

-- Test 3: Check daily_suggestions schema has new metadata columns
-- Expected: All 5 columns exist (menu_item_id, menu_item_name, content_type, service_period, content_angle)
SELECT 
  'Test 3: daily_suggestions Schema' as test_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'daily_suggestions'
  AND column_name IN ('menu_item_id', 'menu_item_name', 'content_type', 'service_period', 'content_angle')
ORDER BY column_name;

-- Test 4: Simulate quick suggestion generation (after function runs)
-- Run this AFTER calling the function to verify metadata was saved
-- Expected: Recent suggestion with metadata populated
WITH recent_suggestions AS (
  SELECT 
    title,
    content_type,
    menu_item_name,
    service_period,
    content_angle,
    suggested_time,
    created_at
  FROM daily_suggestions
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid
    AND source = 'quick_suggestions'
    AND date >= CURRENT_DATE
  ORDER BY created_at DESC
  LIMIT 3
)
SELECT 
  'Test 4: Recent Suggestions Metadata' as test_name,
  *
FROM recent_suggestions;

-- Test 5: Verify metadata propagation to published_posts (after user accepts suggestion)
-- Run this AFTER accepting a suggestion to verify metadata flows through
-- Expected: Published post with menu_item_name and content_type populated
SELECT 
  'Test 5: Metadata in Published Posts' as test_name,
  created_at,
  status,
  idea_source,
  menu_item_name,
  content_type
FROM published_posts
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid
  AND idea_source = 'quick_suggestions'
  AND menu_item_name IS NOT NULL
ORDER BY created_at DESC
LIMIT 3;

-- Test 6: Rotation queue effectiveness check
-- Expected: Dishes should be suggested in fair rotation (least-recently-posted first)
WITH dish_history AS (
  SELECT 
    menu_item_name,
    MAX(created_at) as last_suggested,
    COUNT(*) as suggestion_count
  FROM daily_suggestions
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid
    AND menu_item_name IS NOT NULL
    AND menu_item_name != ''
  GROUP BY menu_item_name
)
SELECT 
  'Test 6: Rotation Fairness' as test_name,
  COUNT(DISTINCT menu_item_name) as unique_dishes_suggested,
  MIN(suggestion_count) as min_suggestions,
  MAX(suggestion_count) as max_suggestions,
  ROUND(AVG(suggestion_count), 2) as avg_suggestions,
  CASE 
    WHEN MAX(suggestion_count) - MIN(suggestion_count) <= 2 THEN 'Fair rotation ✅'
    ELSE 'Uneven distribution ⚠️'
  END as rotation_status
FROM dish_history;

-- EXPECTED OUTCOMES:
-- Test 1: Should return 5+ dishes from Cafe Faust menu
-- Test 2: Should return 3 programmes with time_windows arrays
-- Test 3: Should show all 5 metadata columns exist
-- Test 4: Should show recent suggestions with populated metadata (run after function call)
-- Test 5: Should show published posts with metadata (run after accepting suggestions)
-- Test 6: Should show fair rotation status after several suggestion cycles
