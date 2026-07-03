-- Check structured_data.programs format
SELECT 
  id,
  service_period_name,
  structured_data->>'menuTitle' as menu_title,
  structured_data->'programs' as programs,
  jsonb_pretty(structured_data->'programs') as programs_pretty
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
LIMIT 1;
