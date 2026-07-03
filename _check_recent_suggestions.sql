-- Check if FAUSTBURGER was suggested recently
SELECT 
  menu_item_name,
  created_at,
  ROUND(EXTRACT(EPOCH FROM (NOW() - created_at))/86400) AS days_ago,
  LEFT(generated_text, 100) AS text_preview
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND created_at >= NOW() - INTERVAL '14 days'
  AND menu_item_name IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
