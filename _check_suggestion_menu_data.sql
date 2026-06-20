-- Check what data is in a typical suggestion that gets sent to text generation
-- This shows what the Edge Function receives as input

SELECT 
  id,
  title,
  hook,
  content_block,
  menu_item_name,
  menu_item_description,
  content_type,
  cta_intent,
  source
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND suggestion_date >= CURRENT_DATE - INTERVAL '7 days'
  AND content_type IN ('menu_item', 'product_menu', 'craving_visual')
ORDER BY created_at DESC
LIMIT 10;

-- Check if menu_item_name and menu_item_description are being populated
SELECT 
  COUNT(*) as total_suggestions,
  COUNT(menu_item_name) as has_menu_name,
  COUNT(menu_item_description) as has_menu_desc,
  ROUND(COUNT(menu_item_name)::numeric / COUNT(*)::numeric * 100, 1) as pct_with_name,
  ROUND(COUNT(menu_item_description)::numeric / COUNT(*)::numeric * 100, 1) as pct_with_desc
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND content_type IN ('menu_item', 'product_menu', 'craving_visual')
  AND suggestion_date >= CURRENT_DATE - INTERVAL '30 days';
