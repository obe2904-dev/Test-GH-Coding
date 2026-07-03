-- Check if internal columns exist and have data
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'business_location_intelligence'
  AND column_name LIKE '%_internal%'
ORDER BY column_name;
