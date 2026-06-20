-- Check business_brand_profile structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_brand_profile'
ORDER BY ordinal_position;

-- Check businesses structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'businesses'
ORDER BY ordinal_position;
