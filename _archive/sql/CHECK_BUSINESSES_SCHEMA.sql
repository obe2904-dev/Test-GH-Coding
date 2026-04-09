-- Check actual columns in businesses table
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'businesses'
  AND table_schema = 'public'
ORDER BY ordinal_position;
