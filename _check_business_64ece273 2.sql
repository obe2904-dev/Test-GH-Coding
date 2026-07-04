-- Check if the business exists with all required columns
SELECT 
  id,
  name,
  vertical,
  website_url,
  country,
  owner_id,
  created_at
FROM businesses
WHERE id = '64ece273-bca0-4410-8cf9-2678d8bfaf20';

-- Check if local_location_reference column exists and what value it has
SELECT 
  id,
  name,
  local_location_reference
FROM businesses
WHERE id = '64ece273-bca0-4410-8cf9-2678d8bfaf20';

-- Check the authenticated user's businesses
SELECT 
  b.id,
  b.name,
  b.owner_id,
  u.email
FROM businesses b
LEFT JOIN auth.users u ON b.owner_id = u.id
ORDER BY b.created_at DESC
LIMIT 10;
