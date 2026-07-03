-- Check ALL menu_results_v2 for Café Faust (both Danish and English)
SELECT 
  mr.language_code,
  mr.service_period_name,
  mr.status,
  CASE 
    WHEN mr.representative_dishes IS NULL THEN 'NULL'
    WHEN jsonb_typeof(mr.representative_dishes) = 'object' THEN 
      'object with ' || COALESCE(jsonb_array_length(mr.representative_dishes->'dishes'), 0)::text || ' dishes'
    ELSE jsonb_typeof(mr.representative_dishes)
  END as repr_dishes_info
FROM menu_results_v2 mr
WHERE mr.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY mr.language_code, mr.service_period_name;
