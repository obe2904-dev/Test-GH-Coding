-- 3. Total unique dishes AI can see
SELECT 
  COUNT(DISTINCT item.value->>'name') AS total_unique_dishes,
  string_agg(DISTINCT LEFT(item.value->>'name', 50), ', ' ORDER BY LEFT(item.value->>'name', 50)) AS sample_dishes
FROM menu_results_v2 AS menu,
     jsonb_array_elements(menu.structured_data->'categories') AS cat,
     jsonb_array_elements(cat->'items') AS item
WHERE menu.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND menu.status = 'done'
  AND menu.language_code = 'da';
