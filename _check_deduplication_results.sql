-- Check deduplication results and current state

-- 1. Did the deduplication find any duplicates?
-- (Check the NOTICES output from the script you just ran)

-- 2. How many menu items exist for Cafe Faust now?
SELECT COUNT(*) as total_menu_items
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 3. Show all MOULES FRITES entries (should be only 1 now)
SELECT 
  id,
  item_name,
  item_description,
  menu_result_id,
  created_at
FROM menu_items_normalized
WHERE UPPER(TRIM(item_name)) = 'MOULES FRITES'
  AND business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC;

-- 4. Check all daily_suggestions for this business (not just menu items)
SELECT 
  id,
  title,
  menu_item_name,
  menu_item_id,
  content_type,
  date,
  is_active,
  generated_text IS NOT NULL as has_text
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY date DESC, created_at DESC
LIMIT 20;

-- 5. Count suggestions by content type
SELECT 
  content_type,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE menu_item_id IS NOT NULL) as with_menu_id
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
GROUP BY content_type
ORDER BY count DESC;
