-- Check what columns actually exist in business_brand_profile
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_brand_profile'
ORDER BY ordinal_position;
