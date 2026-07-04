-- TEST: Verify PHASE_A_CONTENT_TYPE_FOUNDATION.sql syntax and logic
-- Run this BEFORE running the actual migration to check for issues

-- Dry-run: Check if columns already exist (should return 0 for new installs)
SELECT 
  'target_type_mix exists' as check_name,
  COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'business_brand_profile' 
  AND column_name = 'target_type_mix'
  AND table_schema = 'public';

SELECT 
  'accepts_reservations exists' as check_name,
  COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'business_programme_profiles' 
  AND column_name = 'accepts_reservations'
  AND table_schema = 'public';

SELECT 
  'is_active exists' as check_name,
  COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'business_programme_profiles' 
  AND column_name = 'is_active'
  AND table_schema = 'public';

-- Check if tables exist (should return 1 for both)
SELECT 
  'business_brand_profile exists' as check_name,
  COUNT(*) as table_count
FROM information_schema.tables
WHERE table_name = 'business_brand_profile'
  AND table_schema = 'public';

SELECT 
  'business_programme_profiles exists' as check_name,
  COUNT(*) as table_count
FROM information_schema.tables
WHERE table_name = 'business_programme_profiles'
  AND table_schema = 'public';

-- Check current data in business_brand_profile (how many rows will be affected)
SELECT 
  'business_brand_profile rows' as check_name,
  COUNT(*) as row_count
FROM business_brand_profile;

-- Check current data in business_programme_profiles (how many rows will be affected)
SELECT 
  'business_programme_profiles rows' as check_name,
  COUNT(*) as row_count
FROM business_programme_profiles;

-- Check decision_timing values (to validate UPDATE logic)
SELECT 
  'decision_timing distribution' as check_name,
  decision_timing,
  COUNT(*) as count
FROM business_programme_profiles
GROUP BY decision_timing
ORDER BY count DESC;

-- Validate JSONB syntax (should parse without error)
SELECT 
  'JSONB syntax test' as check_name,
  '{
    "product": 0.35,
    "experience": 0.30,
    "occasion": 0.25,
    "retention": 0.10
  }'::jsonb as parsed_json;

-- Check sum of default type mix (should be 1.0)
SELECT 
  'Default type mix sum' as check_name,
  (parsed->>'product')::numeric + 
  (parsed->>'experience')::numeric + 
  (parsed->>'occasion')::numeric + 
  (parsed->>'retention')::numeric as total
FROM (
  SELECT '{
    "product": 0.35,
    "experience": 0.30,
    "occasion": 0.25,
    "retention": 0.10
  }'::jsonb as parsed
) t;
