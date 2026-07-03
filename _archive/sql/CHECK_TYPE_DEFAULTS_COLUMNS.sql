-- Check what columns actually exist in business_type_defaults
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_type_defaults'
ORDER BY ordinal_position;

-- Check if table has any data
SELECT COUNT(*) as row_count FROM business_type_defaults;

-- Show sample data
SELECT * FROM business_type_defaults LIMIT 3;
