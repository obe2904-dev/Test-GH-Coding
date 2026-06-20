-- ============================================================================
-- DIAGNOSE MISSING PROGRAMMES ON BRAND PAGE
-- ============================================================================
-- Business ID from logs: 561f8fe8-41cb-4191-87e4-5cabf9bcdd79
-- Issue: V5 generation completed with 3 programmes but UI shows nothing
-- ============================================================================

-- 1. Check if business exists
SELECT 
  id,
  name,
  owner_id,
  created_at
FROM businesses
WHERE id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';

-- 2. Check business_brand_profile - V5 data
SELECT 
  business_id,
  brand_profile_v5 IS NOT NULL as has_v5_profile,
  brand_profile_v5_generated_at,
  brand_profile_v5_version,
  menu_overview_summary IS NOT NULL as has_menu_summary,
  updated_at
FROM business_brand_profile
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';

-- 3. Check business_programme_profiles - THIS IS THE KEY!
SELECT 
  programme_type,
  programme_name,
  time_windows,
  confidence,
  baseline_goal_split,
  audience_segments,
  created_at,
  updated_at
FROM business_programme_profiles
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
ORDER BY programme_type;

-- 4. Count programmes
SELECT COUNT(*) as programme_count
FROM business_programme_profiles
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';

-- ============================================================================
-- EXPECTED RESULT:
-- - Query #1: Should show business exists
-- - Query #2: Should show has_v5_profile = true AND recent timestamp
-- - Query #3: Should show 3 programme rows (brunch, lunch, dinner, etc.)
-- - Query #4: Should show programme_count = 3
--
-- IF Query #3 returns 0 rows:
-- → The Edge Function generated the programmes but didn't save them to the table
-- → Need to check Edge Function logs or re-run generation
-- ============================================================================
