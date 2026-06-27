-- Check if programme profiles were actually saved to the database
-- Business ID: 07b7a9f6-d2cf-4fa9-85af-714a8b294ea4 (Café Faust)

-- Step 1: Check business_programme_profiles table
SELECT 
  business_id,
  programme_type,
  programme_name,
  confidence,
  created_at
FROM business_programme_profiles
WHERE business_id = '07b7a9f6-d2cf-4fa9-85af-714a8b294ea4'
ORDER BY programme_type;

-- Step 2: Check brand_profile_v5 JSONB column for programmes data
SELECT 
  business_id,
  brand_profile_v5 -> 'programme_profiles' as programmes_in_v5,
  jsonb_array_length(brand_profile_v5 -> 'programme_profiles') as programme_count
FROM business_brand_profile
WHERE business_id = '07b7a9f6-d2cf-4fa9-85af-714a8b294ea4';

-- Step 3: Check if RLS policies might be blocking access
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'business_programme_profiles';

-- Step 4: Verify audience segments are saved in programme profiles
SELECT 
  programme_type,
  programme_name,
  jsonb_array_length(audience_segments) as segment_count,
  segment_confidence,
  segment_reasoning
FROM business_programme_profiles
WHERE business_id = '07b7a9f6-d2cf-4fa9-85af-714a8b294ea4';
