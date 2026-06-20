-- Check which menu tables actually exist in production database

-- List all tables with 'menu' in name
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%menu%'
ORDER BY table_name;

-- Check if menu_items_normalized exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name = 'menu_items_normalized'
) AS menu_items_normalized_exists;

-- Count rows in menu_results_v2 for Café Faust
SELECT COUNT(*) AS menu_results_v2_count
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- See structure of menu_results_v2 for Café Faust
SELECT 
  id,
  business_id,
  service_periods,
  structured_data,
  created_at
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC
LIMIT 2;
