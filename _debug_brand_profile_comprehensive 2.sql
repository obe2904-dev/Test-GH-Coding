-- COMPREHENSIVE BRAND PROFILE V5 DATA CHECK
-- Business ID: 07b7a9f6-d2cf-4fa9-85af-714a8b294ea4 (Café Faust)

-- Check 1: Do programme profiles exist in the table?
SELECT 
  'Programme Profiles Count' as check_name,
  COUNT(*) as result
FROM business_programme_profiles
WHERE business_id = '07b7a9f6-d2cf-4fa9-85af-714a8b294ea4';

-- Check 2: If they exist, what are they?
SELECT 
  programme_type,
  programme_name,
  confidence,
  jsonb_array_length(audience_segments) as segment_count,
  created_at
FROM business_programme_profiles
WHERE business_id = '07b7a9f6-d2cf-4fa9-85af-714a8b294ea4'
ORDER BY programme_type;

-- Check 3: Check brand_profile_v5 JSONB for programmes
SELECT 
  business_id,
  jsonb_array_length(brand_profile_v5 -> 'programme_profiles') as programmes_in_v5_jsonb,
  (brand_profile_v5 -> 'programme_profiles' -> 0 ->> 'type') as first_programme_type,
  updated_at
FROM business_brand_profile
WHERE business_id = '07b7a9f6-d2cf-4fa9-85af-714a8b294ea4';

-- Check 4: Verify RLS policies on business_programme_profiles
SELECT 
  tablename,
  policyname,
  permissive,
  roles::text[],
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'business_programme_profiles'
ORDER BY policyname;

-- Check 5: Test if current user can see the business
SELECT 
  id,
  name,
  owner_id
FROM businesses
WHERE id = '07b7a9f6-d2cf-4fa9-85af-714a8b294ea4';
