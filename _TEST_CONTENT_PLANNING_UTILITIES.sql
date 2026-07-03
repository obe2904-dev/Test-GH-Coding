-- =====================================================
-- Test the new content planning utilities
-- =====================================================
-- 
-- This tests the rotation queue and pattern tracker
-- Run this to verify Migration Phase 0 is working correctly
--
-- =====================================================

-- Test 1: Rotation queue performance (should use idx_published_posts_menu_rotation)
EXPLAIN ANALYZE
SELECT 
  menu_item_name,
  MAX(posted_at) as last_posted_at,
  COUNT(*) as total_posts,
  EXTRACT(EPOCH FROM (NOW() - MAX(posted_at))) / 86400 as days_since_posted
FROM published_posts
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid
  AND menu_item_name IS NOT NULL
  AND posted_at >= (NOW() - INTERVAL '90 days')
GROUP BY menu_item_name
ORDER BY days_since_posted DESC NULLS FIRST
LIMIT 10;

-- Expected: Uses idx_published_posts_menu_rotation, execution time < 1ms

-- Test 2: Pattern history performance (should use idx_published_posts_pattern_history)
EXPLAIN ANALYZE
SELECT 
  EXTRACT(DOW FROM posted_at) as weekday,
  content_type,
  COUNT(*) as count
FROM published_posts
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid
  AND posted_at >= (NOW() - INTERVAL '14 days')
  AND content_type IS NOT NULL
GROUP BY weekday, content_type
ORDER BY weekday, count DESC;

-- Expected: Uses idx_published_posts_pattern_history, execution time < 1ms

-- Test 3: Check menu items with service periods
SELECT 
  item_name,
  service_periods,
  array_length(service_periods, 1) as period_count
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid
LIMIT 5;

-- Expected: Returns menu items with their service_periods text[] array

-- Test 4: Programme configuration
SELECT 
  programme_name,
  time_windows,
  operating_days
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid
ORDER BY programme_name;

-- Expected: Returns brunch/lunch/dinner programme configurations with time_windows arrays

-- Test 5: Brand voice essential fields
SELECT 
  brand_essence,
  LENGTH(brand_essence) as essence_length,
  brand_essence IS NOT NULL as has_brand_essence
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid;

-- Expected: Returns brand_essence (should be >20 chars for quality)

-- =====================================================
-- ✅ All queries should complete in < 5ms total
-- If any query is slow, check EXPLAIN ANALYZE output
-- =====================================================
