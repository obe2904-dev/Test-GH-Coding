-- ========================================
-- LAYER 1: BUSINESS FUNDAMENTALS VERIFICATION
-- ========================================

-- Q1: Find Café Faust business_id
SELECT id, name, category, country
FROM businesses 
WHERE name ILIKE '%faust%';

-- Q2: Show all businesses (if Q1 returns nothing)
SELECT id, name, category, country, owner_id
FROM businesses 
ORDER BY created_at DESC
LIMIT 5;

-- Q3: Show all locations
SELECT business_id, city, country, is_primary
FROM business_locations
ORDER BY created_at DESC
LIMIT 5;

-- Q4: Show all brand profiles
SELECT business_id, tone_keywords, voice_style, values, certifications
FROM business_brand_profile
ORDER BY created_at DESC
LIMIT 5;

-- Q5: Check menu_results_v2 table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'menu_results_v2'
ORDER BY ordinal_position;

-- Q6: Show menu data structure
SELECT 
  id,
  business_id,
  structured_data->>'menuTitle' as menu_title,
  jsonb_typeof(structured_data) as data_type,
  jsonb_array_length(structured_data->'categories') as category_count
FROM menu_results_v2
ORDER BY created_at DESC
LIMIT 5;

-- Q7: Count total menu items
SELECT 
  mr.business_id,
  structured_data->>'menuTitle' as menu_title,
  COUNT(*) as item_count
FROM menu_results_v2 mr,
  jsonb_array_elements(mr.structured_data->'categories') as cat,
  jsonb_array_elements(cat->'items') as item
GROUP BY mr.business_id, structured_data->>'menuTitle'
ORDER BY item_count DESC;

-- Q8: Show ALL menu items (first 20)
SELECT 
  structured_data->>'menuTitle' as menu_title,
  cat->>'name' as category_name,
  item->>'name' as item_name,
  LENGTH(item->>'description') as description_length,
  item->>'price' as item_price
FROM menu_results_v2 mr,
  jsonb_array_elements(mr.structured_data->'categories') as cat,
  jsonb_array_elements(cat->'items') as item
ORDER BY menu_title, category_name, item_name
LIMIT 20;

-- Q9: Verify specific items (FAVORITTEN, PARISERBØF, ÆGGEKAGE)
SELECT 
  structured_data->>'menuTitle' as menu_title,
  cat->>'name' as category_name,
  item->>'name' as item_name,
  item->>'description' as item_description,
  item->>'price' as item_price
FROM menu_results_v2 mr,
  jsonb_array_elements(mr.structured_data->'categories') as cat,
  jsonb_array_elements(cat->'items') as item
WHERE item->>'name' IN ('FAVORITTEN', 'PARISERBØF', 'ÆGGEKAGE')
ORDER BY item->>'name';
