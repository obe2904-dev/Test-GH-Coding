-- ============================================================================
-- VALIDATE HYBRID PERSONA IMPLEMENTATION
-- ============================================================================
-- Purpose: Verify HYBRID business identity persona is stored in database
-- Test Business: Café Faust (f4679fa9-3120-4a59-9506-d059b010c34a)
-- ============================================================================

-- 1. Check if city_context_cache table exists and has data
SELECT 
  'City Context Cache Status' as check_name,
  COUNT(*) as cached_cities,
  COUNT(*) FILTER (WHERE ai_generated = true) as ai_generated_count,
  COUNT(*) FILTER (WHERE ai_generated = false) as manual_count
FROM city_context_cache;

-- 2. Check specific city contexts (should have the 5 seeded cities)
SELECT 
  city,
  country,
  population,
  city_size,
  cultural_context,
  ai_generated,
  cached_until > NOW() as is_valid
FROM city_context_cache
ORDER BY population DESC;

-- 3. Check brand_profile_v5 for Café Faust - HYBRID persona
SELECT 
  id,
  business_id,
  -- Check if new fields exist
  layer_0_intelligence ? 'business_identity' as has_business_identity,
  layer_0_intelligence ? 'city_context_ai' as has_city_context_ai,
  -- Extract HYBRID persona
  layer_0_intelligence->'business_identity'->>'system_persona' as business_identity_persona,
  layer_0_intelligence->'business_identity'->>'word_count' as persona_word_count,
  layer_0_intelligence->'business_identity'->>'generated_at' as persona_generated_at,
  layer_0_intelligence->'business_identity'->'signature_items_count' as signature_items,
  layer_0_intelligence->'business_identity'->'programmes_count' as programmes,
  -- Extract city context AI
  layer_0_intelligence->'city_context_ai'->>'city' as city,
  layer_0_intelligence->'city_context_ai'->>'population' as population,
  layer_0_intelligence->'city_context_ai'->>'city_size' as city_size,
  layer_0_intelligence->'city_context_ai'->>'cultural_context' as cultural_context,
  layer_0_intelligence->'city_context_ai'->>'ai_generated' as ai_generated,
  layer_0_intelligence->'city_context_ai'->>'cached_until' as cached_until,
  -- Check legacy fields still exist
  layer_0_intelligence ? 'professional_persona' as has_legacy_persona,
  layer_0_intelligence ? 'geographic_context' as has_geographic_context,
  created_at,
  updated_at
FROM brand_profile_v5
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC
LIMIT 1;

-- 4. FULL business identity persona (formatted for reading)
SELECT 
  layer_0_intelligence->'business_identity'->>'system_persona' as "Business Identity Persona (HYBRID)"
FROM brand_profile_v5
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC
LIMIT 1;

-- 5. Compare OLD vs NEW persona approach
SELECT 
  'Legacy Consultant Persona' as approach,
  LEFT(layer_0_intelligence->'professional_persona'->>'system_prompt_preview', 200) as persona_preview
FROM brand_profile_v5
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC
LIMIT 1

UNION ALL

SELECT 
  'NEW HYBRID Business Identity' as approach,
  LEFT(layer_0_intelligence->'business_identity'->>'system_persona', 200) as persona_preview
FROM brand_profile_v5
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC
LIMIT 1;

-- 6. Validation checks
SELECT 
  business_id,
  -- Quality checks
  CASE 
    WHEN layer_0_intelligence->'business_identity'->>'system_persona' IS NULL 
    THEN '❌ FAIL: business_identity missing'
    WHEN layer_0_intelligence->'business_identity'->>'system_persona' NOT LIKE 'Du er %' 
    THEN '❌ FAIL: Does not start with "Du er"'
    WHEN layer_0_intelligence->'business_identity'->>'system_persona' LIKE '%professionel%' 
    THEN '❌ FAIL: Contains "professionel" (consultant language)'
    WHEN layer_0_intelligence->'business_identity'->>'system_persona' LIKE '%ekspertise%' 
    THEN '❌ FAIL: Contains "ekspertise" (marketing language)'
    WHEN (layer_0_intelligence->'business_identity'->>'word_count')::int < 50
    THEN '⚠️  WARNING: Word count < 50 (too short)'
    WHEN (layer_0_intelligence->'business_identity'->>'word_count')::int > 200
    THEN '⚠️  WARNING: Word count > 200 (too long)'
    ELSE '✅ PASS: Business identity looks good'
  END as quality_check,
  layer_0_intelligence->'business_identity'->>'word_count' as word_count,
  layer_0_intelligence->'business_identity'->>'generated_at' as generated_at
FROM brand_profile_v5
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC
LIMIT 1;

-- 7. Check if city context is cached properly
SELECT 
  'Aarhus City Context' as check_name,
  city,
  population,
  city_size,
  cultural_context,
  cached_until,
  cached_until > NOW() as is_valid,
  ai_generated
FROM city_context_cache
WHERE city = 'Aarhus' AND country = 'Denmark';
