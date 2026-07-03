-- ============================================================================
-- REGENERATE BRAND PROFILE TO POPULATE CONTENT_STRATEGY
-- ============================================================================
-- Issue: Café Faust's brand_profile was created before content_strategy was added
-- Solution: Trigger full regeneration to populate content_strategy from programmes
-- ============================================================================

-- 1. Check current state: Does content_strategy exist?
SELECT 
  business_id,
  brand_voice->'content_strategy' as content_strategy,
  brand_voice->'content_strategy'->'goal_blend' as goal_blend,
  brand_voice->'posting_strategy'->'booking_model_type' as booking_model_type,
  updated_at,
  CASE 
    WHEN brand_voice->'content_strategy' IS NULL THEN '❌ MISSING - needs regeneration'
    WHEN brand_voice->'content_strategy'->'goal_blend' IS NULL THEN '⚠️ content_strategy exists but goal_blend missing'
    ELSE '✅ content_strategy with goal_blend present'
  END as status
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. Check source data: What programmes exist?
SELECT 
  programme_type,
  baseline_goal_split,
  content_type_affinity,
  is_active
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY programme_type;

-- ============================================================================
-- OPTION A: Force regeneration by deleting existing profile (RECOMMENDED)
-- ============================================================================
-- This will trigger the dashboard to regenerate the full brand profile
-- DELETE FROM business_brand_profile 
-- WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Then in the dashboard: Go to Café Faust → Brand Profile → Generate

-- ============================================================================
-- OPTION B: Manually patch content_strategy (TEMPORARY FIX)
-- ============================================================================
-- Only use if you can't wait for full regeneration
-- UPDATE business_brand_profile
-- SET brand_voice = jsonb_set(
--   brand_voice,
--   '{content_strategy}',
--   '{
--     "goal_blend": {
--       "drive_footfall": 50,
--       "build_brand": 30,
--       "retain_loyalty": 20
--     },
--     "content_category_weights": {
--       "product_menu": 35,
--       "craving_visual": 25,
--       "behind_scenes": 25,
--       "team_people": 15
--     }
--   }'::jsonb,
--   true
-- )
-- WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After regeneration, check that content_strategy is populated
SELECT 
  brand_voice->'content_strategy'->'goal_blend' as goal_blend,
  brand_voice->'content_strategy'->'content_category_weights' as content_weights,
  updated_at
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
