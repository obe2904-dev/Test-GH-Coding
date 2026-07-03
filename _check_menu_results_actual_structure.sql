-- Check actual structure of menu_results_v2
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'menu_results_v2'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Then check what columns actually have data for Café Faust
SELECT *
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
LIMIT 3;
