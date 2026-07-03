-- Check menu source labels for Cafe Faust
SELECT 
  id,
  source_url,
  label,
  menu_type,
  created_at
FROM menu_sources
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC;
