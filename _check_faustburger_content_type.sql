-- Check content_type for FAUSTBURGER suggestions
SELECT 
  menu_item_name,
  content_type,
  created_at,
  ROUND(EXTRACT(EPOCH FROM (NOW() - created_at))/86400) AS days_ago,
  generated_text IS NULL AS text_is_null
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND UPPER(menu_item_name) LIKE '%FAUSTBURGER%'
  AND created_at >= NOW() - INTERVAL '14 days'
ORDER BY created_at DESC;
