-- Check business_programme_profiles schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'business_programme_profiles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check what columns actually exist
SELECT *
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
LIMIT 1;
