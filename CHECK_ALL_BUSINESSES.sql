-- Check if there's ANY data in business_profile table
SELECT 
  business_id,
  short_description,
  created_at,
  CASE 
    WHEN menu_structure IS NULL THEN 'No menu'
    WHEN jsonb_array_length(menu_structure::jsonb) = 0 THEN 'Empty menu'
    ELSE jsonb_array_length(menu_structure::jsonb)::text || ' categories'
  END as menu_info
FROM business_profile
ORDER BY created_at DESC
LIMIT 5;

-- Count total rows
SELECT COUNT(*) as total_businesses FROM business_profile;
