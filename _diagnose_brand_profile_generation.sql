-- ============================================================================
-- DIAGNOSE V5 BRAND PROFILE GENERATION
-- ============================================================================

-- 1. Check if brand_profile was created (should be empty after DELETE)
SELECT 
  business_id,
  brand_voice,
  updated_at,
  CASE 
    WHEN brand_voice IS NULL THEN '❌ NULL - not regenerated yet'
    WHEN brand_voice->'content_strategy' IS NULL THEN '⚠️ Regenerated but missing content_strategy'
    WHEN brand_voice->'content_strategy'->'goal_blend' IS NULL THEN '⚠️ content_strategy exists but missing goal_blend'
    ELSE '✅ COMPLETE - content_strategy with goal_blend present'
  END as status
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. Check if business_programme_profiles exist (required for Stage PS)
SELECT 
  programme_type,
  baseline_goal_split,
  content_type_affinity,
  is_active,
  created_at
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY programme_type;

-- 3. Check website_analyses (the 406 error was related to this)
SELECT 
  id,
  status,
  created_at,
  analysis_result->'error' as error_details
FROM website_analyses
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC
LIMIT 3;

-- 4. Check if there are any V5 programme-level brand profiles
SELECT 
  programme_type,
  brand_essence,
  positioning_statement,
  core_values,
  created_at,
  updated_at
FROM business_programme_brand_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY programme_type;

-- ============================================================================
-- EXPECTED STATE AFTER SUCCESSFUL REGENERATION
-- ============================================================================
-- Query 1: Should show row with brand_voice populated, status = "✅ COMPLETE"
-- Query 2: Should show 2-4 programmes (brunch, lunch, dinner, bar)
-- Query 3: Should show successful website_analysis
-- Query 4: Should show programme-level brand profiles

-- ============================================================================
-- IF GENERATION FAILED
-- ============================================================================
-- Check Supabase Functions logs for brand-profile-generator errors
-- Common issues:
-- - 406 error: PostgREST content negotiation issue (usually transient)
-- - Missing website_analyses: V5 generator requires website analysis
-- - Missing programmes: Stage PS needs at least 1 programme

-- Manual trigger (if UI button didn't work):
-- Call brand-profile-generator Edge Function directly via API
