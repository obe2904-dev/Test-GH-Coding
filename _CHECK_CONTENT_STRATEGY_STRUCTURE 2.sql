-- ============================================================================
-- CHECK ACTUAL content_strategy STRUCTURE IN DATABASE
-- ============================================================================
-- Business ID: f4679fa9-3120-4a59-9506-d059b010c34a
-- Goal: See the exact structure of content_strategy field
-- ============================================================================

-- 1. Get the raw content_strategy field
SELECT 
  business_id,
  content_strategy,
  jsonb_pretty(content_strategy) as content_strategy_formatted,
  pg_typeof(content_strategy) as field_type
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. Check if goal_blend exists within content_strategy
SELECT 
  business_id,
  content_strategy->>'goal_blend' as goal_blend_as_text,
  content_strategy->'goal_blend' as goal_blend_as_jsonb,
  (content_strategy->'goal_blend') IS NOT NULL as has_goal_blend
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 3. Extract the individual goal percentages
SELECT 
  business_id,
  content_strategy->'goal_blend'->>'drive_footfall' as drive_footfall,
  content_strategy->'goal_blend'->>'build_brand' as build_brand,
  content_strategy->'goal_blend'->>'retain_loyalty' as retain_loyalty
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- EXPECTED RESULT:
-- ============================================================================
-- If the fix SQL worked correctly, you should see:
-- {
--   "goal_blend": {
--     "drive_footfall": 57,
--     "build_brand": 27,
--     "retain_loyalty": 17
--   },
--   "content_category_weights": {...},
--   "primary_goal": "drive_footfall",
--   "source": "3 programmes"
-- }
-- ============================================================================
