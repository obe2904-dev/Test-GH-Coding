-- Find which business belongs to which user
-- Run this in Supabase Dashboard SQL Editor

-- Show all businesses with their owners
SELECT 
  b.id as business_id,
  b.name as business_name,
  b.owner_id,
  u.email as owner_email
FROM businesses b
LEFT JOIN auth.users u ON u.id = b.owner_id
ORDER BY b.name;

-- Check if the business the frontend is querying exists
SELECT 
  id,
  name,
  owner_id,
  created_at
FROM businesses
WHERE id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- Check if Café Faust exists
SELECT 
  id,
  name,
  owner_id,
  created_at
FROM businesses
WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Check which business has V5 programme profiles
SELECT 
  business_id,
  COUNT(*) as programme_count,
  array_agg(programme_name) as programmes
FROM business_programme_profiles
GROUP BY business_id;

-- Check which business has brand profiles
SELECT 
  business_id,
  COALESCE(positioning, 'NO POSITIONING') as positioning_status,
  COALESCE(brand_essence, 'NO ESSENCE') as essence_status
FROM business_brand_profile
ORDER BY business_id;
