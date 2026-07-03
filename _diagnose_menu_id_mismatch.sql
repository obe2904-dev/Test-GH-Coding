-- Diagnose Menu ID Mismatch
-- Check where ID aaef7251-aeb9-4475-97b5-8bf092606bae exists

-- 1. Check if ID exists in menu_items_normalized
SELECT 'menu_items_normalized' AS table_name, id, item_name, business_id
FROM menu_items_normalized
WHERE id = 'aaef7251-aeb9-4475-97b5-8bf092606bae';

-- 2. Check if ID exists in menu_results_v2 (raw menu data)
SELECT 'menu_results_v2' AS table_name, id, business_id, created_at
FROM menu_results_v2
WHERE id = 'aaef7251-aeb9-4475-97b5-8bf092606bae';

-- 3. Check daily_suggestions that reference this ID
SELECT 'daily_suggestions' AS table_name,
  id,
  title,
  menu_item_id,
  menu_item_name,
  generated_text,
  date,
  created_at
FROM daily_suggestions
WHERE menu_item_id = 'aaef7251-aeb9-4475-97b5-8bf092606bae'
ORDER BY created_at DESC
LIMIT 5;

-- 4. Find the correct menu item by name "MOULES FRITES"
SELECT 'menu_items_normalized (by name)' AS table_name,
  id,
  item_name,
  item_description,
  menu_result_id,
  business_id
FROM menu_items_normalized
WHERE UPPER(item_name) = 'MOULES FRITES';

-- 5. Check if there are orphaned menu_item_ids in daily_suggestions
-- (IDs that don't exist in menu_items_normalized)
SELECT 
  ds.menu_item_id,
  ds.menu_item_name,
  COUNT(*) as suggestion_count,
  MAX(ds.date) as latest_date
FROM daily_suggestions ds
LEFT JOIN menu_items_normalized min ON ds.menu_item_id = min.id
WHERE ds.menu_item_id IS NOT NULL
  AND min.id IS NULL  -- No matching row in menu_items_normalized
GROUP BY ds.menu_item_id, ds.menu_item_name
ORDER BY suggestion_count DESC
LIMIT 10;
