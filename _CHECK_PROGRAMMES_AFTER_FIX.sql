-- ============================================================================
-- CHECK IF PROGRAMMES WERE SAVED AFTER FIX
-- ============================================================================
-- Run this AFTER regenerating the brand profile
-- Business ID: 561f8fe8-41cb-4191-87e4-5cabf9bcdd79
-- ============================================================================

-- 1. Check if programmes exist now
SELECT 
  programme_type,
  programme_name,
  time_windows,
  confidence,
  is_active,
  created_at,
  updated_at
FROM business_programme_profiles
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
ORDER BY programme_type;

-- 2. Count programmes
SELECT COUNT(*) as programme_count
FROM business_programme_profiles
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';

-- 3. Check brand profile generation timestamp
SELECT 
  business_id,
  brand_profile_v5_generated_at,
  updated_at
FROM business_brand_profile
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';

-- ============================================================================
-- EXPECTED AFTER FIX:
-- - Query #1: Should show 3+ programmes (brunch, lunch, dinner, etc.)
-- - Query #2: Should show programme_count >= 3
-- - Query #3: Should show recent timestamp (within last few minutes)
-- ============================================================================
