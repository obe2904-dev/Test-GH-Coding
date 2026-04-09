-- Check what menu categories were actually extracted
SELECT 
  business_id,
  short_description,
  CASE 
    WHEN jsonb_typeof(menu_structure) = 'array' THEN jsonb_array_length(menu_structure)
    ELSE 0
  END as category_count,
  jsonb_typeof(menu_structure) as menu_structure_type,
  menu_structure as menu_categories
FROM business_profile
ORDER BY created_at DESC
LIMIT 1;
