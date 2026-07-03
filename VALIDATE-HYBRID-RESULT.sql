-- Validate HYBRID Persona Quality for Café Faust
-- Check that persona is business-specific identity (HYBRID approach)

-- 1. Extract the business_identity persona
SELECT 
  business_id,
  brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona' as "Business Identity Persona",
  brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'word_count' as "Word Count",
  brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'signature_items_count' as "Signature Items",
  brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'city_context_used' as "City Context Used",
  brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'generated_at' as "Generated At"
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY updated_at DESC
LIMIT 1;

-- 2. Quality Checks
SELECT 
  'Quality Checks' as test_category,
  CASE 
    WHEN brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona' LIKE 'Du er Café Faust%' 
      OR brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona' LIKE 'Du er Cafe Faust%'
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END as "Starts with 'Du er Café Faust'",
  
  CASE 
    WHEN brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona' NOT LIKE '%professionel%'
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END as "Does NOT contain 'professionel'",
  
  CASE 
    WHEN brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona' NOT LIKE '%ekspertise%'
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END as "Does NOT contain 'ekspertise'",
  
  CASE 
    WHEN (brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'word_count')::int BETWEEN 100 AND 150
    THEN '✅ PASS (' || (brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'word_count') || ' words)'
    ELSE '⚠️  WARNING (' || (brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'word_count') || ' words)'
  END as "Word count 100-150",
  
  CASE 
    WHEN brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona' LIKE '%Aarhus%'
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END as "Contains city 'Aarhus'",
  
  CASE 
    WHEN brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona' LIKE '%ved åen%'
    THEN '✅ PASS' 
    ELSE '⚠️  WARNING' 
  END as "Contains location 'ved åen'"
  
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY updated_at DESC
LIMIT 1;

-- 3. Check city context AI data
SELECT 
  'City Context' as test_category,
  brand_profile_v5->'layer_0_intelligence'->'city_context_ai'->>'city' as "City",
  brand_profile_v5->'layer_0_intelligence'->'city_context_ai'->>'population' as "Population",
  brand_profile_v5->'layer_0_intelligence'->'city_context_ai'->>'city_size' as "City Size",
  brand_profile_v5->'layer_0_intelligence'->'city_context_ai'->>'cultural_context' as "Cultural Context",
  brand_profile_v5->'layer_0_intelligence'->'city_context_ai'->>'ai_generated' as "AI Generated",
  brand_profile_v5->'layer_0_intelligence'->'city_context_ai'->>'cached_until' as "Cached Until"
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY updated_at DESC
LIMIT 1;

-- 4. Compare OLD vs NEW persona approach
WITH latest_profile AS (
  SELECT brand_profile_v5
  FROM business_brand_profile
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  ORDER BY updated_at DESC
  LIMIT 1
)
SELECT 
  'OLD (Generic Consultant)' as approach,
  brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'expertise_areas' as persona_preview
FROM latest_profile

UNION ALL

SELECT 
  'NEW (Business Identity)' as approach,
  LEFT(brand_profile_v5->'layer_0_intelligence'->'business_identity'->>'system_persona', 200) || '...' as persona_preview
FROM latest_profile;
