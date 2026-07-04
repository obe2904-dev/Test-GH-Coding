-- ============================================================================
-- CAFE FAUST PERSONA SUMMARY
-- ============================================================================
-- Quick view of the professional persona that drives all content generation
-- ============================================================================

-- 1. BUSINESS TYPE DETECTION (What kind of business is it?)
SELECT 
  '1. BUSINESS TYPE' as component,
  brand_profile_v5->'layer_0_intelligence'->'business_type'->>'detected_type' as detected_type,
  brand_profile_v5->'layer_0_intelligence'->'business_type'->>'professional_domain' as professional_domain_danish,
  brand_profile_v5->'layer_0_intelligence'->'business_type'->>'confidence' as confidence
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- 2. GEOGRAPHIC CONTEXT (Where is it?)
SELECT 
  '2. GEOGRAPHIC CONTEXT' as component,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'city' as value,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'population_size' as detail1,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'location_type' as detail2
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- 3. PROFESSIONAL PERSONA (Who is the AI?)
SELECT 
  '3. PERSONA FORMALITY' as component,
  brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'formality' as value,
  brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'sentence_style' as detail1,
  brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'emoji_usage' as detail2
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- 4. VOICE ARCHETYPE (How should it sound?)
SELECT 
  '4. VOICE ARCHETYPE' as component,
  brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->>'archetype_id' as value,
  brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->>'base_rules_count' as detail1,
  brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->>'location_context_weight' as detail2
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

ORDER BY component;

-- ============================================================================
-- FULL SYSTEM PROMPT (What the AI is told to be)
-- ============================================================================

SELECT 
  'SYSTEM PROMPT PREVIEW' as section,
  LEFT(brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'system_prompt', 800) as first_800_chars
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
