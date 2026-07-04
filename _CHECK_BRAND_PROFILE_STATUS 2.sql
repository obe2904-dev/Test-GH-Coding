-- ============================================================================
-- CHECK BRAND PROFILE STATUS FOR CAFÉ FAUST
-- ============================================================================
-- Business ID: f4679fa9-3120-4a59-9506-d059b010c34a
-- Issue: After regenerating brand profile, UI shows same as before
-- ============================================================================

-- 1. Check if business exists
SELECT 
  id,
  name,
  owner_id,
  establishment_type,
  category,
  created_at
FROM businesses
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. Check business_brand_profile table
SELECT 
  business_id,
  brand_profile_v5 IS NOT NULL as has_v5_profile,
  brand_profile_v5_generated_at,
  brand_profile_v5_version,
  business_identity_persona IS NOT NULL as has_persona,
  strategic_audience_segments IS NOT NULL as has_segments,
  enhanced_social_examples IS NOT NULL as has_social_examples,
  business_character IS NOT NULL as has_character,
  updated_at,
  created_at
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 3. Check business_programme_profiles table
SELECT 
  id,
  business_id,
  programme_type,
  programme_name,
  time_windows,
  confidence,
  baseline_goal_split,
  created_at,
  updated_at
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY programme_type;

-- 4. Check menu_overview_summary in business_brand_profile
SELECT 
  business_id,
  menu_overview_summary,
  gastronomic_profile,
  signature_themes
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 5. Count total records for this business
SELECT 
  'business_brand_profile' as table_name,
  COUNT(*) as record_count
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
UNION ALL
SELECT 
  'business_programme_profiles' as table_name,
  COUNT(*) as record_count
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- DIAGNOSIS QUESTIONS:
-- ============================================================================
-- Q1: Does business_brand_profile row exist?
--     - YES: Data was not deleted, or was regenerated
--     - NO: Data was deleted, need to regenerate
--
-- Q2: Is brand_profile_v5_generated_at recent (last 24 hours)?
--     - YES: Profile was recently regenerated
--     - NO: Profile is old, regeneration didn't work
--
-- Q3: Do business_programme_profiles exist?
--     - YES: Layer 1 was completed
--     - NO: Layer 1 failed or was deleted
-- ============================================================================
