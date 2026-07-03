-- Check menu data quality for Café Faust
-- Verify what information the AI is getting about menu items
-- ✅ menu_items_normalized NOW EXISTS - synced 178 items

-- 1. Check menu_items_normalized table (FAST normalized access)
SELECT 
  item_name,
  item_description,
  length(item_description) as desc_length,
  category_name,
  category_type
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY item_name
LIMIT 20;

-- 1b. Check Pariserbøf specifically
SELECT 
  item_name,
  item_description,
  category_name
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND item_name ILIKE '%paris%';

-- 2. Check menu_results_v2 for available menus (source data)
SELECT 
  id,
  language_code,
  service_period_name,
  jsonb_array_length(structured_data->'categories') as category_count,
  is_signature,
  completed_at
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY completed_at DESC
LIMIT 5;

-- 2. Check menu_results_v2 structured data
SELECT 
  language_code,
  jsonb_array_length(structured_data->'categories') as category_count,
  structured_data->'categories'->0->'name' as first_category,
  jsonb_array_length(structured_data->'categories'->0->'items') as first_cat_item_count
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
LIMIT 5;

-- 3. Sample menu item with full details from structured data
SELECT 
  cat->>'name' as category,
  item->>'name' as item_name,
  item->>'description' as item_description,
  item->>'price' as price,
  length(item->>'description') as desc_length
FROM menu_results_v2,
  jsonb_array_elements(structured_data->'categories') as cat,
  jsonb_array_elements(cat->'items') as item
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND item->>'name' ILIKE '%paris%'  -- Find Pariserbøf
LIMIT 5;

-- 4. Check what daily_suggestions have for menu data (what actually gets sent to AI)
SELECT 
  id,
  title,
  menu_item_name as "Menu Item Name",
  menu_item_description as "Description AI Gets",
  length(menu_item_description) as "Char Count",
  content_type,
  CASE 
    WHEN menu_item_description IS NULL THEN '❌ No description'
    WHEN length(menu_item_description) < 10 THEN '⚠️ Too short'
    WHEN menu_item_description LIKE '%,%,%,%,%' THEN '⚠️ List format'
    ELSE '✅ Good quality'
  END as quality_status
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND menu_item_name ILIKE '%paris%'
ORDER BY date DESC
LIMIT 5;
