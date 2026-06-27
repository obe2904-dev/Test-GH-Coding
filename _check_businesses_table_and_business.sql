-- Check if local_location_reference column exists in businesses table
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'businesses'
  AND table_schema = 'public'
  AND column_name = 'local_location_reference';

-- Check if the specific business exists
SELECT 
  id,
  name,
  vertical,
  website_url,
  country
FROM businesses
WHERE id = '64ece273-bca0-4410-8cf9-2678d8bfaf20';

-- Try to select with local_location_reference (will fail if column doesn't exist)
SELECT 
  id,
  name,
  vertical,
  website_url,
  country,
  local_location_reference
FROM businesses
WHERE id = '64ece273-bca0-4410-8cf9-2678d8bfaf20';
