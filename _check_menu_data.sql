-- Check menu data for Cafe Faust
-- Business ID: f4679fa9-3120-4a59-9506-d059b010c34a

-- Check menu_results_v2 (full menu extraction)
SELECT 
  id,
  business_id,
  source_url,
  service_period_name,
  cuisine_style,
  structured_data::text LIKE '%CLUB%SANDWICH%' AS has_club_sandwich,
  LEFT(structured_data::text, 200) as data_preview,
  created_at
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC
LIMIT 3;

-- Check menu_items_normalized (normalized items with descriptions)
SELECT 
  item_name,
  item_description,
  category_name,
  created_at
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND item_name ILIKE '%club%sandwich%'
ORDER BY created_at DESC;

-- Check if there's ANY menu data at all
SELECT 
  'menu_results_v2' as table_name,
  COUNT(*) as count
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
UNION ALL
SELECT 
  'menu_items_normalized' as table_name,
  COUNT(*) as count
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
