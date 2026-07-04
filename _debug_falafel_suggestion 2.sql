-- Debug query: Check the actual data in daily_suggestions for FALAFEL BURGER
SELECT 
  id,
  title,
  menu_item_name,
  menu_item_description,
  caption_base,
  content_type,
  rationale,
  suggestion_date,
  created_at
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND title ILIKE '%FALAFEL%'
  AND is_active = true
ORDER BY created_at DESC
LIMIT 3;
