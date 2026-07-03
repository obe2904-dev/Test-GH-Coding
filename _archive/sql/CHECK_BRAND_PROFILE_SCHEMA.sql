-- Check actual column types in business_brand_profile table
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'business_brand_profile'
  AND table_schema = 'public'
ORDER BY ordinal_position;
