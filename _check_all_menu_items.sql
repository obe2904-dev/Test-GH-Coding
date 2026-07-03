-- Check what menu items exist in your database
SELECT 
  item_name,
  LEFT(item_description, 100) as description_preview,
  LENGTH(item_description) as desc_length,
  service_period_name,
  service_periods
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY item_name;
