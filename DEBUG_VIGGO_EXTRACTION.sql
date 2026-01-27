-- DEBUG: Check what data was extracted for Café Viggo
-- Run this to see what the analyze-website function stored

-- Main business profile info
SELECT 
  business_id,
  short_description,
  long_description,
  
  -- Check if menu was extracted
  CASE 
    WHEN menu_structure IS NULL THEN '❌ NULL'
    WHEN menu_structure::text = '{}' THEN '❌ Empty object'
    WHEN menu_structure::text = '[]' THEN '❌ Empty array'
    WHEN jsonb_array_length(menu_structure::jsonb) = 0 THEN '❌ Empty categories array'
    ELSE '✓ Has ' || jsonb_array_length(menu_structure::jsonb)::text || ' categories'
  END as menu_status,
  
  -- Show first 200 chars of menu
  LEFT((menu_structure::text), 200) as menu_preview,
  
  -- Check if brand context was generated
  CASE 
    WHEN ai_brand_context IS NULL THEN '❌ NULL'
    WHEN LENGTH(ai_brand_context) < 100 THEN '❌ Too short (' || LENGTH(ai_brand_context)::text || ' chars)'
    ELSE '✓ Generated (' || LENGTH(ai_brand_context)::text || ' chars)'
  END as brand_context_status,
  
  -- Show first 300 chars of brand context
  LEFT(ai_brand_context, 300) as brand_context_preview,
  
  -- Menu description
  LEFT(menu_description, 200) as menu_description_preview,
  
  -- General info
  created_at
  
FROM business_profile
WHERE business_id::text ILIKE '%viggo%'
   OR short_description ILIKE '%viggo%'
ORDER BY created_at DESC
LIMIT 1;


-- Check the full menu_structure JSON
SELECT 
  business_id,
  menu_structure,
  LENGTH(menu_description) as menu_description_length
FROM business_profile
WHERE business_id::text ILIKE '%viggo%'
   OR short_description ILIKE '%viggo%'
ORDER BY created_at DESC
LIMIT 1;
