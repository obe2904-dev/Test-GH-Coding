-- Investigate actual menu data for the test business
-- Business ID: 840347de-9ba7-4275-8aa3-4553417fc2af

-- 1. Check if business has menu data in menu_results_v2
SELECT 
  business_id,
  id,
  menu_url,
  status,
  created_at,
  updated_at
FROM menu_results_v2
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
LIMIT 5;

-- 2. Check the structured_data to see actual menu items
SELECT 
  business_id,
  structured_data->'menu'->'sections' as menu_sections,
  jsonb_array_length(structured_data->'menu'->'sections') as section_count
FROM menu_results_v2
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
AND structured_data IS NOT NULL
LIMIT 1;

-- 3. Extract actual dish names from the menu
SELECT 
  business_id,
  jsonb_array_elements(structured_data->'menu'->'sections') as section
FROM menu_results_v2
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
AND structured_data IS NOT NULL
LIMIT 1;

-- 4. Get first section details
SELECT 
  business_id,
  structured_data->'menu'->'sections'->0->'name' as section_name,
  structured_data->'menu'->'sections'->0->'items' as items
FROM menu_results_v2
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
AND structured_data IS NOT NULL
LIMIT 1;

-- 5. Check what businesses actually have menu data
SELECT 
  business_id,
  COUNT(*) as menu_count,
  MAX(created_at) as latest_menu
FROM menu_results_v2
GROUP BY business_id
ORDER BY menu_count DESC
LIMIT 10;
