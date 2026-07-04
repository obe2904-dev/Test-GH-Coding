-- ============================================================================
-- CHECK CONTENT STRATEGY STATUS FOR CAFÉ FAUST
-- ============================================================================
-- Business ID: f4679fa9-3120-4a59-9506-d059b010c34a
-- Issue: UI shows "Ingen baseline content strategy fundet"
-- Expected: content_strategy should be aggregated from business_programme_profiles
-- ============================================================================

-- 1. Check business_programme_profiles baseline_goal_split
SELECT 
  programme_type,
  programme_name,
  baseline_goal_split,
  created_at
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY programme_type;

-- Expected: Should show 3 programmes with baseline_goal_split like:
-- {"drive_footfall": 60, "retain_regulars": 15, "strengthen_brand": 25}

-- 2. Check business_brand_profile content_strategy field
SELECT 
  business_id,
  content_strategy,
  brand_profile_v5_generated_at,
  updated_at
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Expected: content_strategy should contain:
-- {
--   "goal_blend": {"drive_footfall": XX, "build_brand": XX, "retain_loyalty": XX},
--   "content_category_weights": {...},
--   "primary_goal": "drive_footfall" or "build_brand" or "retain_loyalty",
--   "source": "3 programmes"
-- }

-- 3. Manual calculation of average (for reference)
-- If we have 3 programmes, the average should be:
-- drive_footfall: avg of all programmes' drive_footfall
-- strengthen_brand: avg of all programmes' strengthen_brand  
-- retain_regulars: avg of all programmes' retain_regulars
-- Then map to new names: build_brand (from strengthen_brand), retain_loyalty (from retain_regulars)

WITH programme_averages AS (
  SELECT 
    AVG((baseline_goal_split->>'drive_footfall')::int) as avg_drive_footfall,
    AVG((baseline_goal_split->>'strengthen_brand')::int) as avg_strengthen_brand,
    AVG((baseline_goal_split->>'retain_regulars')::int) as avg_retain_regulars
  FROM business_programme_profiles
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
    AND baseline_goal_split IS NOT NULL
)
SELECT 
  'Expected goal_blend:' as note,
  jsonb_build_object(
    'drive_footfall', ROUND(avg_drive_footfall),
    'build_brand', ROUND(avg_strengthen_brand),
    'retain_loyalty', ROUND(avg_retain_regulars)
  ) as calculated_goal_blend
FROM programme_averages;

-- ============================================================================
-- DIAGNOSIS:
-- ============================================================================
-- If content_strategy is NULL or missing goal_blend:
--   → The deriveContentStrategy() function didn't run or failed
--   → Need to regenerate brand profile OR run manual update
--
-- If content_strategy exists with correct structure:
--   → Weekly plan generator might not be reading it correctly
--   → Check brand_voice.content_strategy in weekly plan logs
-- ============================================================================
