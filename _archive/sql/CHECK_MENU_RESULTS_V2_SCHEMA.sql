-- Check menu_results_v2 schema
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'menu_results_v2'
  AND table_schema = 'public'
ORDER BY ordinal_position;
