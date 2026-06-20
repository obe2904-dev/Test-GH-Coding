-- Check the actual structure of representative_dishes in menu_results_v2
SELECT 
  mr.menu_id,
  mr.language_code,
  mr.service_period_name,
  mr.status,
  jsonb_typeof(mr.representative_dishes) as repr_type,
  CASE 
    WHEN jsonb_typeof(mr.representative_dishes) = 'array' THEN jsonb_array_length(mr.representative_dishes)
    ELSE NULL
  END as array_length,
  jsonb_pretty(mr.representative_dishes) as representative_dishes_structure
FROM menu_results_v2 mr
WHERE mr.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND mr.representative_dishes IS NOT NULL
ORDER BY mr.completed_at DESC
LIMIT 3;
