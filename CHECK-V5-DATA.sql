-- CHECK IF V5 BRAND PROFILE DATA EXISTS
-- Run this in Supabase Dashboard SQL Editor
-- This bypasses RLS to show you the actual data

-- Business info
SELECT 
  id,
  name,
  owner_id,
  created_at
FROM businesses
WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Programme profiles (NEW V5 data)
SELECT 
  programme_type,
  programme_name,
  time_windows,
  operating_days,
  decision_timing,
  confidence,
  created_at,
  updated_at
FROM business_programme_profiles
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY programme_type;

-- Count audience segments per programme
SELECT 
  programme_name,
  jsonb_array_length(audience_segments) as segment_count
FROM business_programme_profiles  
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Brand profile (Layer 3 - positioning field)
SELECT 
  business_id,
  positioning,
  brand_essence,
  created_at,
  updated_at
FROM business_brand_profile
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Check RLS policy - who can see this business?
SELECT 
  b.id as business_id,
  b.name,
  b.owner_id,
  u.email as owner_email
FROM businesses b
LEFT JOIN auth.users u ON u.id = b.owner_id
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';
