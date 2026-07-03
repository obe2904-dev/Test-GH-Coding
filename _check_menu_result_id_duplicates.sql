-- Check if duplicate menu items share the same menu_result_id
-- This determines our deduplication strategy

-- 1. Show all MOULES FRITES entries with their menu_result_id
SELECT 
  id as row_id,
  menu_result_id,
  item_name,
  created_at
FROM menu_items_normalized
WHERE UPPER(TRIM(item_name)) = 'MOULES FRITES'
  AND business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC;

-- 2. Check all menu items for this business grouped by menu_result_id
SELECT 
  menu_result_id,
  COUNT(*) as count,
  STRING_AGG(DISTINCT item_name, ', ') as item_names
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
GROUP BY menu_result_id
ORDER BY count DESC;

-- 3. Find duplicates by item name
SELECT 
  UPPER(TRIM(item_name)) as normalized_name,
  COUNT(*) as duplicate_count,
  STRING_AGG(DISTINCT menu_result_id::TEXT, ', ') as menu_result_ids,
  STRING_AGG(DISTINCT id::TEXT, ', ') as row_ids
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
GROUP BY UPPER(TRIM(item_name))
HAVING COUNT(*) > 1;

-- 4. Check what menu_item_id values are in daily_suggestions
SELECT 
  ds.menu_item_id,
  ds.menu_item_name,
  ds.title,
  min.menu_result_id,
  min.item_name as actual_name
FROM daily_suggestions ds
LEFT JOIN menu_items_normalized min ON ds.menu_item_id = min.id
WHERE ds.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND ds.menu_item_id IS NOT NULL
ORDER BY ds.created_at DESC;
