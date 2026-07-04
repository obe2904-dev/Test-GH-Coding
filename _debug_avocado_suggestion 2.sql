-- Debug: Find the actual suggestion data for "Avocado"
SELECT 
  id,
  title,
  menu_item_name,
  menu_item_description,
  caption_base,
  rationale,
  content_type,
  suggestion_date
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND (title ILIKE '%Avocado%' OR title ILIKE '%avocado%')
  AND is_active = true
ORDER BY created_at DESC
LIMIT 1;
