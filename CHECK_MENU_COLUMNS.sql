-- Check actual column names in menu_extractions table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'menu_extractions' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
