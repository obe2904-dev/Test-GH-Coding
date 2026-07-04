-- Check the most recent menu extraction errors
SELECT 
  id,
  source_url,
  status,
  error_message,
  source_content_type,
  created_at,
  completed_at
FROM menu_results_v2
WHERE source_url LIKE '%k-bbq.dk%Menu%'
ORDER BY created_at DESC
LIMIT 5;

-- Check the menu_sources table too
SELECT 
  id,
  url,
  status,
  error_message,
  created_at,
  updated_at
FROM menu_sources
WHERE url LIKE '%k-bbq.dk%Menu%'
ORDER BY created_at DESC
LIMIT 5;
