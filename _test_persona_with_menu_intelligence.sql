-- Test: Does persona include the new menu intelligence we just fixed?
-- Run in Supabase SQL Editor

SELECT 
  b.name,
  bbp.brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona' as current_persona,
  bbp.brand_profile_v5->'layer_0_intelligence'->'business_identity'->'metadata' as persona_metadata,
  length(bbp.brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona') as persona_char_count,
  
  -- Check if persona includes menu intelligence keywords
  CASE 
    WHEN bbp.brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona' LIKE '%smørrebrød%' THEN '✅'
    ELSE '❌'
  END as has_menu_examples,
  
  CASE 
    WHEN bbp.brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona' LIKE '%fusion%' THEN '✅'
    ELSE '❌'
  END as has_gastronomic_character,
  
  CASE 
    WHEN bbp.brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona' LIKE '%Hjemmelavede%' THEN '✅'
    ELSE '❌'
  END as has_signature_themes,
  
  bbp.brand_profile_v5->'layer_0_intelligence'->'business_identity'->'metadata'->>'generated_at' as persona_last_generated,
  bbp.updated_at as profile_last_updated
  
FROM business_brand_profile bbp
JOIN businesses b ON b.id = bbp.business_id
WHERE bbp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
