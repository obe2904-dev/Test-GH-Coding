-- Check if Café Faust has representative_dishes in menu_results_v2
SELECT 
  mr.menu_id,
  mr.language_code,
  mr.representative_dishes,
  jsonb_array_length(COALESCE(mr.representative_dishes, '[]'::jsonb)) as dish_count
FROM menu_results_v2 mr
JOIN menus m ON m.id = mr.menu_id
JOIN businesses b ON b.id = m.business_id
WHERE b.name ILIKE '%faust%'
  AND mr.language_code = 'da'
ORDER BY mr.updated_at DESC;
