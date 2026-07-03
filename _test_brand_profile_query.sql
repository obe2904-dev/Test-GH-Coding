-- Test the exact query that get-weekly-strategy is using
-- This should show us what data is actually being returned

SELECT 
  business_character,
  revenue_drivers,
  brand_profile_v5
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Also check if revenue_drivers is NULL or has data
SELECT 
  business_id,
  CASE 
    WHEN revenue_drivers IS NULL THEN '❌ NULL'
    ELSE '✅ HAS DATA'
  END AS revenue_drivers_status,
  revenue_drivers::text AS revenue_drivers_raw,
  LENGTH(revenue_drivers::text) AS data_length
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Check if there are any RLS policies on this table
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
WHERE tablename = 'business_brand_profile';
