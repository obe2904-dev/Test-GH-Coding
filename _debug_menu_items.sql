-- Debug query: Check what menu items exist for this business
SELECT 
  item_name,
  item_description,
  menu_name,
  created_at
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND (
    item_name ILIKE '%FALAFEL%'
    OR item_name ILIKE '%OMELET%'
    OR item_name ILIKE '%BURGER%'
  )
ORDER BY item_name;
