-- Check menu_results_v2 schema and data for language filtering

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'menu_results_v2'
ORDER BY ordinal_position;

-- Check what language-related fields exist in actual data
SELECT 
  id,
  business_id,
  service_period_name,
  source_language,
  detected_language,
  status,
  completed_at
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY completed_at DESC;
