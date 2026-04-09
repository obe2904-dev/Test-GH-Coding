-- ============================================================================
-- FINAL VERIFICATION: Will AI Generation Find Menu Items?
-- Business ID: 840347de-9ba7-4275-8aa3-4553417fc2af
-- ============================================================================

-- Query 1: What the AI code will find
-- This simulates exactly what menu-scorer.ts does
-- ============================================================================
WITH menu_data AS (
  SELECT 
    business_id,
    structured_data
  FROM menu_results_v2
  WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
    AND status = 'done'
),
extracted_items AS (
  SELECT 
    business_id,
    structured_data->>'menuTitle' as menu_name,
    cat.value->>'name' as category_name,
    item.value->>'name' as item_name,
    item.value->>'description' as description,
    item.value->>'price' as price
  FROM menu_data,
  jsonb_array_elements(structured_data->'categories') AS cat,
  jsonb_array_elements(cat.value->'items') AS item
)
SELECT 
  '✅ ITEMS AI WILL FIND' as "Status",
  COUNT(*) as "Total Items",
  COUNT(DISTINCT menu_name) as "Menus",
  COUNT(DISTINCT category_name) as "Categories",
  array_agg(DISTINCT menu_name) as "Menu Names"
FROM extracted_items;


-- Query 2: Sample of items (what will be scored)
-- ============================================================================
WITH menu_data AS (
  SELECT 
    business_id,
    structured_data
  FROM menu_results_v2
  WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
    AND status = 'done'
),
extracted_items AS (
  SELECT 
    business_id,
    structured_data->>'menuTitle' as menu_name,
    cat.value->>'name' as category_name,
    item.value->>'name' as item_name,
    item.value->>'description' as description,
    item.value->>'price' as price
  FROM menu_data,
  jsonb_array_elements(structured_data->'categories') AS cat,
  jsonb_array_elements(cat.value->'items') AS item
)
SELECT 
  menu_name as "Menu",
  category_name as "Category",
  item_name as "Item Name",
  LEFT(description, 80) as "Description Preview",
  price as "Price"
FROM extracted_items
ORDER BY menu_name, category_name
LIMIT 15;


-- Query 3: Verify Query 1-5 from earlier - Complete Business Context
-- ============================================================================
SELECT 
  'COMPLETE AI PROMPT DATA' as "Check",
  CASE WHEN b.name IS NOT NULL THEN '✅ ' || b.name ELSE '❌ No name' END as "Business Name",
  CASE WHEN b.category IS NOT NULL THEN '✅ ' || b.category ELSE '❌ No category' END as "Category",
  CASE WHEN b.country IS NOT NULL THEN '✅ ' || b.country ELSE '❌ No country' END as "Country",
  CASE WHEN bl.city IS NOT NULL THEN '✅ ' || bl.city ELSE '❌ No city' END as "City",
  CASE WHEN bp.values IS NOT NULL AND array_length(bp.values, 1) > 0 
       THEN '✅ ' || array_length(bp.values, 1)::text || ' values' 
       ELSE '❌ No values' END as "Values",
  CASE WHEN bp.tone_keywords IS NOT NULL AND array_length(bp.tone_keywords, 1) > 0 
       THEN '✅ ' || array_length(bp.tone_keywords, 1)::text || ' keywords' 
       ELSE '❌ No tone' END as "Tone Keywords",
  CASE WHEN (
    SELECT COUNT(*) 
    FROM menu_results_v2 
    WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af' AND status = 'done'
  ) > 0 
       THEN '✅ ' || (
         SELECT COUNT(*) 
         FROM menu_results_v2 
         WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af' AND status = 'done'
       )::text || ' menus'
       ELSE '❌ No menus' END as "Menu Data"
FROM businesses b
LEFT JOIN business_brand_profile bp ON b.id = bp.business_id
LEFT JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';


-- ============================================================================
-- SUMMARY:
-- ============================================================================
-- Query 1: Shows how many items AI will find (should be 60-80+ items)
-- Query 2: Shows sample of items that will be used for content generation
-- Query 3: Complete readiness check - all ✅ = ready for AI generation
--
-- Expected Result: ✅ All systems ready for "Generer Ugentlig Plan"
-- ============================================================================
