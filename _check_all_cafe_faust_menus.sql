-- Find ALL menus for Cafe Faust
SELECT 
  ms.id,
  ms.label,
  ms.menu_type,
  ms.source_url,
  mr.service_period_name,
  mr.structured_data->>'menuTitle' as menu_title,
  mr.structured_data->'categories' as categories_preview
FROM menu_sources ms
LEFT JOIN menu_results_v2 mr ON mr.source_id = ms.id
WHERE ms.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY ms.label;
