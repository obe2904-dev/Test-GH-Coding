-- Check the latest menu extraction for Viggo
SELECT 
  business_id,
  short_description,
  menu_structure::text,
  ai_brand_context,
  created_at
FROM business_profile
ORDER BY created_at DESC
LIMIT 1;

-- Also check what categories were found
SELECT 
  business_id,
  jsonb_array_length(menu_structure->'categories') as category_count,
  jsonb_pretty(menu_structure) as menu_json
FROM business_profile
ORDER BY created_at DESC
LIMIT 1;
