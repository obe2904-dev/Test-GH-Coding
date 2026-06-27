-- Check the most recent menu extraction from k-bbq.dk/menu/
SELECT 
  id,
  source_url,
  status,
  error_message,
  created_at,
  completed_at,
  -- Show the actual extracted categories and items
  structured_data->'categories' as categories,
  -- Show if there are items in first category
  jsonb_array_length(structured_data->'categories'->0->'items') as first_category_item_count,
  -- Show first few items from first category
  structured_data->'categories'->0->'items'->0->'name' as first_item,
  structured_data->'categories'->0->'items'->1->'name' as second_item,
  structured_data->'categories'->0->'items'->2->'name' as third_item
FROM menu_results_v2
WHERE source_url LIKE '%k-bbq.dk/menu%'
ORDER BY created_at DESC
LIMIT 1;

-- Also check the image URL status
SELECT 
  id,
  source_url,
  status,
  error_message,
  completed_at
FROM menu_results_v2
WHERE source_url LIKE '%k-bbq.dk%Menu%jpg'
ORDER BY created_at DESC
LIMIT 1;

-- Check menu_sources table to see what UI is displaying
SELECT 
  id,
  url,
  status,
  error_message,
  label,
  created_at,
  updated_at
FROM menu_sources
WHERE url LIKE '%k-bbq.dk%'
ORDER BY created_at DESC
LIMIT 5;
