-- Verify V5 Brand Profile Generator Results
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql

-- 1. Check business_programme_profiles table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'business_programme_profiles'
    ) 
    THEN '✅ business_programme_profiles table EXISTS'
    ELSE '❌ business_programme_profiles table MISSING'
  END AS table_status;

-- 2. Check what programmes were saved for Cafe Faust
SELECT 
  programme_type,
  programme_name,
  time_windows,
  operating_days,
  menu_evidence,
  confidence,
  baseline_goal_split,
  decision_timing,
  audience_segments,
  created_at
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY programme_type;

-- 3. Check if AFTEN/Cocktails menu is in the results
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM business_programme_profiles
      WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
      AND (programme_name ILIKE '%AFTEN%' OR programme_name ILIKE '%cocktail%')
    )
    THEN '⚠️ AFTEN/Cocktails programme FOUND (should be filtered)'
    ELSE '✅ AFTEN/Cocktails programme NOT FOUND (correctly filtered)'
  END AS drinks_filter_status;

-- 4. Check menu_sources labels for Cafe Faust
SELECT 
  id,
  label,
  menu_type,
  source_url,
  created_at
FROM menu_sources
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY label;

-- 5. Check what's in business_brand_profile for Cafe Faust
SELECT 
  positioning,
  core_values,
  what_makes_us_different,
  identity_confidence,
  identity_reasoning,
  updated_at
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
