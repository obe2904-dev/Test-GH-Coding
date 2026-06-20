-- Check if daily_suggestions table has menu_item_id
SELECT 
  id,
  title,
  menu_item_id,
  menu_item_name
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND is_active = true
ORDER BY created_at DESC
LIMIT 5;
