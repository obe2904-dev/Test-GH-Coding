-- Debug: Find all menu items with "omelet" or "avocado"
SELECT 
  item_name,
  item_description,
  service_period_name
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND (
    item_name ILIKE '%omelet%'
    OR item_name ILIKE '%avocado%'
    OR item_description ILIKE '%omelet%'
  )
ORDER BY item_name;
