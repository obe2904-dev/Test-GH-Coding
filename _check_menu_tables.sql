-- Check available menu tables and structure
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('menu_results_v2', 'menu_items_normalized', 'menu_sources')
ORDER BY table_name, ordinal_position;
