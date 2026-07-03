-- ============================================================================
-- LAYER 0 QUALITY VALIDATION QUERIES
-- ============================================================================
-- Use these to validate Layer 0 intelligence quality before integration
-- ============================================================================

-- 1. CHECK IF FULL SYSTEM PROMPT EXISTS (Critical!)
-- Expected: Should have full prompt, not just preview
SELECT 
  'System Prompt Check' as test,
  business_id,
  CASE 
    WHEN brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'system_prompt' IS NULL 
    THEN '❌ MISSING'
    WHEN LENGTH(brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'system_prompt') < 500
    THEN '⚠️  TOO SHORT'
    ELSE '✅ EXISTS'
  END as status,
  LENGTH(brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'system_prompt') as full_prompt_length,
  LENGTH(brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'system_prompt_preview') as preview_length
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. VERIFY ALL LAYER 0 COMPONENTS EXIST
-- Expected: All should be ✅
SELECT 
  'Component Completeness' as test,
  CASE WHEN brand_profile_v5->'layer_0_intelligence'->'business_type' IS NOT NULL THEN '✅' ELSE '❌' END as business_type,
  CASE WHEN brand_profile_v5->'layer_0_intelligence'->'geographic_context' IS NOT NULL THEN '✅' ELSE '❌' END as geographic_context,
  CASE WHEN brand_profile_v5->'layer_0_intelligence'->'professional_persona' IS NOT NULL THEN '✅' ELSE '❌' END as professional_persona,
  CASE WHEN brand_profile_v5->'layer_0_intelligence'->'voice_archetype' IS NOT NULL THEN '✅' ELSE '❌' END as voice_archetype,
  CASE WHEN jsonb_array_length(brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->'base_rules') >= 5 THEN '✅' ELSE '⚠️' END as has_enough_rules
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 3. BUSINESS TYPE CONFIDENCE CHECK
-- Expected: Confidence should be > 0.7 for production use
SELECT 
  'Business Type Quality' as test,
  brand_profile_v5->'layer_0_intelligence'->'business_type'->>'detected_type' as detected_type,
  brand_profile_v5->'layer_0_intelligence'->'business_type'->>'professional_domain' as domain,
  brand_profile_v5->'layer_0_intelligence'->'business_type'->>'confidence' as confidence,
  CASE 
    WHEN (brand_profile_v5->'layer_0_intelligence'->'business_type'->>'confidence')::float >= 0.8 THEN '✅ HIGH'
    WHEN (brand_profile_v5->'layer_0_intelligence'->'business_type'->>'confidence')::float >= 0.6 THEN '⚠️  MEDIUM'
    ELSE '❌ LOW'
  END as quality,
  brand_profile_v5->'layer_0_intelligence'->'business_type'->>'reasoning' as reasoning
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 4. VOICE ARCHETYPE RULE COUNT
-- Expected: 6-17 rules (too few = generic, too many = overwhelming)
SELECT 
  'Voice Archetype Quality' as test,
  brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->>'archetype_id' as archetype_id,
  jsonb_array_length(brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->'base_rules') as rule_count,
  CASE 
    WHEN jsonb_array_length(brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->'base_rules') BETWEEN 6 AND 17 THEN '✅ GOOD'
    WHEN jsonb_array_length(brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->'base_rules') < 6 THEN '⚠️  TOO FEW'
    ELSE '⚠️  TOO MANY'
  END as quality
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 5. GEOGRAPHIC CONTEXT COMPLETENESS
-- Expected: Should have city, location type, and signature reference
SELECT 
  'Geographic Context Quality' as test,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'city' as city,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'location_type' as location_type,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'signature_reference' as signature_ref,
  CASE 
    WHEN brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'city' IS NOT NULL 
     AND brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'location_type' IS NOT NULL
     AND brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'signature_reference' IS NOT NULL
    THEN '✅ COMPLETE'
    ELSE '⚠️  INCOMPLETE'
  END as quality
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 6. PROFESSIONAL PERSONA FORMALITY
-- Expected: Should have clear formality and style
SELECT 
  'Persona Formality' as test,
  brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'formality' as formality,
  brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'sentence_style' as sentence_style,
  brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'emoji_usage' as emoji_usage,
  CASE 
    WHEN brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'formality' IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_formality
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- MULTI-BUSINESS COMPARISON (For testing variety)
-- ============================================================================

-- 7. COMPARE PERSONAS ACROSS DIFFERENT BUSINESSES
-- Expected: Different businesses should have different personas
SELECT 
  b.name as business_name,
  b.establishment_type,
  brand_profile_v5->'layer_0_intelligence'->'business_type'->>'detected_type' as detected_type,
  brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'formality' as formality,
  brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->>'archetype_id' as archetype,
  (brand_profile_v5->'layer_0_intelligence'->'business_type'->>'confidence')::numeric as confidence
FROM business_brand_profile bbp
JOIN businesses b ON b.id = bbp.business_id
WHERE brand_profile_v5->'layer_0_intelligence' IS NOT NULL
ORDER BY b.name
LIMIT 10;

-- 8. CHECK GENERATION FRESHNESS
-- Expected: Recently generated (within last 30 days for active testing)
SELECT 
  'Generation Age' as test,
  brand_profile_v5_generated_at,
  EXTRACT(DAY FROM (NOW() - brand_profile_v5_generated_at)) as days_old,
  CASE 
    WHEN EXTRACT(DAY FROM (NOW() - brand_profile_v5_generated_at)) < 7 THEN '✅ FRESH'
    WHEN EXTRACT(DAY FROM (NOW() - brand_profile_v5_generated_at)) < 30 THEN '⚠️  AGING'
    ELSE '❌ STALE'
  END as freshness
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- EDGE CASE CHECKS
-- ============================================================================

-- 9. CHECK FOR GENERIC/PLACEHOLDER CONTENT
-- Expected: No generic placeholders like "TBD", "TODO", etc.
SELECT 
  'Generic Content Check' as test,
  CASE 
    WHEN brand_profile_v5->'layer_0_intelligence'::text LIKE '%TBD%' THEN '❌ HAS TBD'
    WHEN brand_profile_v5->'layer_0_intelligence'::text LIKE '%TODO%' THEN '❌ HAS TODO'
    WHEN brand_profile_v5->'layer_0_intelligence'::text LIKE '%placeholder%' THEN '❌ HAS PLACEHOLDER'
    ELSE '✅ NO PLACEHOLDERS'
  END as quality
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 10. CHECK VOICE ARCHETYPE UNIQUENESS
-- Expected: Each archetype should have different base_rules
WITH archetype_rules AS (
  SELECT 
    brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->>'archetype_id' as archetype_id,
    brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->'base_rules' as rules
  FROM business_brand_profile
  WHERE brand_profile_v5->'layer_0_intelligence'->'voice_archetype' IS NOT NULL
)
SELECT 
  'Archetype Uniqueness' as test,
  archetype_id,
  COUNT(*) as business_count,
  jsonb_array_length(rules) as rule_count,
  CASE 
    WHEN COUNT(*) > 1 THEN '⚠️  SHARED ARCHETYPE'
    ELSE '✅ UNIQUE'
  END as uniqueness
FROM archetype_rules
GROUP BY archetype_id, rules
ORDER BY business_count DESC;

-- ============================================================================
-- MASTER VALIDATION SUMMARY
-- ============================================================================

-- 11. COMPLETE QUALITY SCORECARD FOR CAFE FAUST
SELECT 
  'LAYER 0 QUALITY SCORECARD' as report,
  -- System Prompt
  CASE WHEN brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'system_prompt' IS NOT NULL 
    AND LENGTH(brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'system_prompt') > 500
    THEN '✅' ELSE '❌' END as "1_full_system_prompt",
  
  -- Business Type
  CASE WHEN (brand_profile_v5->'layer_0_intelligence'->'business_type'->>'confidence')::float >= 0.7
    THEN '✅' ELSE '❌' END as "2_business_type_confidence",
  
  -- Voice Rules
  CASE WHEN jsonb_array_length(brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->'base_rules') BETWEEN 6 AND 17
    THEN '✅' ELSE '❌' END as "3_voice_rule_count",
  
  -- Geographic Context
  CASE WHEN brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'signature_reference' IS NOT NULL
    THEN '✅' ELSE '❌' END as "4_signature_location",
  
  -- Persona Completeness
  CASE WHEN brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'formality' IS NOT NULL
    AND brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'sentence_style' IS NOT NULL
    THEN '✅' ELSE '❌' END as "5_persona_complete",
  
  -- Freshness
  CASE WHEN EXTRACT(DAY FROM (NOW() - brand_profile_v5_generated_at)) < 30
    THEN '✅' ELSE '❌' END as "6_data_fresh",
  
  -- Overall Grade
  CASE 
    WHEN (
      (brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'system_prompt' IS NOT NULL) AND
      ((brand_profile_v5->'layer_0_intelligence'->'business_type'->>'confidence')::float >= 0.7) AND
      (jsonb_array_length(brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->'base_rules') BETWEEN 6 AND 17) AND
      (brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'signature_reference' IS NOT NULL) AND
      (brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'formality' IS NOT NULL)
    ) THEN '✅ READY FOR INTEGRATION'
    ELSE '❌ NEEDS FIXES'
  END as overall_grade
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
