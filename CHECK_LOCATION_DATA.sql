-- Check if location data exists for the test business
SELECT 
  bl.id,
  bl.business_id,
  bl.is_primary,
  bl.phone,
  bl.email,
  bl.address_line1,
  bl.postal_code,
  bl.city,
  bl.country,
  bl.created_at,
  b.name as business_name,
  b.owner_id
FROM business_locations bl
JOIN businesses b ON b.id = bl.business_id
WHERE b.name ILIKE '%faust%'
ORDER BY bl.created_at DESC;

-- Check RLS policies on business_locations
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
WHERE tablename = 'business_locations'
ORDER BY policyname;
