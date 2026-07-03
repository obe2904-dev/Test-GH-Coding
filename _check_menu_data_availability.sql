-- =====================================================
-- CHECK MENU DATA AVAILABILITY
-- =====================================================
-- Run this in Supabase SQL Editor to check menu data
-- =====================================================

-- 1. Check menu_results_v2 (extraction results from menu URLs)
SELECT 
  'menu_results_v2' AS table_name,
  business_id,
  status,
  COUNT(*) AS count,
  STRING_AGG(DISTINCT source_url, ', ') AS source_urls
FROM menu_results_v2
GROUP BY business_id, status
ORDER BY business_id, status;

-- 2. Check menu_items_normalized (individual menu items extracted)
SELECT 
  'menu_items_normalized' AS table_name,
  business_id,
  COUNT(*) AS total_items,
  COUNT(DISTINCT item_name) AS unique_item_names,
  STRING_AGG(DISTINCT item_name, ', ' ORDER BY item_name) AS sample_items
FROM menu_items_normalized
GROUP BY business_id
ORDER BY business_id;

-- 3. Check for specific items you mentioned
SELECT 
  'Specific items check' AS table_name,
  business_id,
  item_name,
  is_signature,
  category_name,
  item_price
FROM menu_items_normalized
WHERE LOWER(item_name) IN ('club sandwich', 'pariserbøf', 'faust burger')
ORDER BY business_id, item_name;

-- 4. Check menu_sources (URLs that have been added)
SELECT 
  'menu_sources' AS table_name,
  business_id,
  COUNT(*) AS source_count,
  STRING_AGG(source_url, ', ') AS source_urls
FROM menu_sources
GROUP BY business_id
ORDER BY business_id;

-- 5. Get full list of items for your business (replace YOUR_BUSINESS_ID)
-- SELECT 
--   item_name,
--   category_name,
--   item_price,
--   is_signature,
--   created_at
-- FROM menu_items_normalized
-- WHERE business_id = 'YOUR_BUSINESS_ID'
-- ORDER BY item_name;

-- =====================================================
-- EXPECTED RESULTS:
-- - menu_results_v2 should show extraction status (done/failed)
-- - menu_items_normalized should show all extracted menu items
-- - If you only see 3 items, database only has 3 items
-- - Check if menu_sources has multiple URLs but only one was extracted
-- =====================================================
