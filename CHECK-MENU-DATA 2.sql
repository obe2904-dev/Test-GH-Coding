-- =====================================================
-- CHECK MENU DATA FOR CAFE FAUST
-- =====================================================
-- Diagnostic query to find what menu data actually exists

-- STEP 1: First check what menu-related tables exist
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%menu%'
ORDER BY table_name;

-- STEP 2: Check if menu_results_v2 has data for Cafe Faust
SELECT 
  id,
  business_id,
  created_at,
  jsonb_typeof(structured_data) as data_type,
  jsonb_array_length(structured_data) as num_sections
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC
LIMIT 1;

-- STEP 3: If menu_results_v2 has data, show first section
SELECT 
  jsonb_array_elements(structured_data) -> 0 as first_section
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC
LIMIT 1;

-- STEP 4: Check business_brand_profile for menu data
SELECT 
  business_id,
  brand_profile_v5 -> 'menuHighlights' as menu_highlights,
  brand_profile_v5 -> 'signatureItems' as signature_items,
  brand_profile_v5_generated_at
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- STEP 5: Check what columns exist in business_brand_profile
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'business_brand_profile'
  AND table_schema = 'public'
ORDER BY ordinal_position;
