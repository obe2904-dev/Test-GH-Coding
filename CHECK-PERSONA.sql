-- ============================================================================
-- CHECK PROFESSIONAL PERSONA FOR CAFE FAUST
-- ============================================================================
-- Shows the Layer 0 Business Intelligence that drives V5.1 profile generation
-- Includes: business type, geographic context, persona, and voice archetype
-- All data shown here is what the AI persona receives and uses
-- ============================================================================

-- View the complete Layer 0 intelligence
SELECT 
  business_id,
  brand_profile_v5_version,
  brand_profile_v5_generated_at,
  jsonb_pretty(brand_profile_v5->'layer_0_intelligence') as layer_0_intelligence
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- CITY PROFILE DESCRIPTION (What AI knows about the city)
-- ============================================================================

SELECT 
  'CITY CONTEXT' as section,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'postal_code' as postal_code,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'city' as city,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'population' as population,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->'city_profile_description'->>'cultural_context' as cultural_context,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->'city_profile_description'->>'tone_guidance' as tone_guidance,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->'city_profile_description'->>'competition_level' as competition_level
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- PROFESSIONAL PERSONA SYSTEM PROMPT (What AI is told to be)
-- ============================================================================

SELECT 
  'PERSONA SYSTEM PROMPT' as section,
  brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'system_prompt_preview' as system_prompt_first_500_chars
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- VOICE ARCHETYPE RULES (Concrete Danish rules AI must follow)
-- ============================================================================

SELECT 
  'VOICE RULES' as section,
  jsonb_pretty(brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->'base_rules') as danish_rules
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- SPECIFIC FIELDS (easier to read)
-- ============================================================================

-- Business Type Detection
SELECT 
  'BUSINESS TYPE' as section,
  'Detected Type' as field,
  brand_profile_v5->'layer_0_intelligence'->'business_type'->>'detected_type' as value
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

SELECT 
  'BUSINESS TYPE' as section,
  'Professional Domain (Danish)' as field,
  brand_profile_v5->'layer_0_intelligence'->'business_type'->>'professional_domain' as value
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

SELECT 
  'BUSINESS TYPE' as section,
  'Confidence' as field,
  brand_profile_v5->'layer_0_intelligence'->'business_type'->>'confidence' as value
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- Geographic Context
SELECT 
  'GEOGRAPHIC CONTEXT' as section,
  'City' as field,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'city' as value
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

SELECT 
  'GEOGRAPHIC CONTEXT' as section,
  'Population Size' as field,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'population_size' as value
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

SELECT 
  'GEOGRAPHIC CONTEXT' as section,
  'Location Type' as field,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'location_type' as value
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

SELECT 
  'GEOGRAPHIC CONTEXT' as section,
  'Signature Reference' as field,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'signature_reference' as value
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- Professional Persona
SELECT 
  'PROFESSIONAL PERSONA' as section,
  'Expertise Areas' as field,
  brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'expertise_areas' as value
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

SELECT 
  'PROFESSIONAL PERSONA' as section,
  'Formality' as field,
  brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'formality' as value
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

SELECT 
  'PROFESSIONAL PERSONA' as section,
  'Sentence Style' as field,
  brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'sentence_style' as value
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

SELECT 
  'PROFESSIONAL PERSONA' as section,
  'Emoji Usage' as field,
  brand_profile_v5->'layer_0_intelligence'->'professional_persona'->>'emoji_usage' as value
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

-- Voice Archetype
SELECT 
  'VOICE ARCHETYPE' as section,
  'Archetype ID' as field,
  brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->>'archetype_id' as value
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

SELECT 
  'VOICE ARCHETYPE' as section,
  'Base Rules Count' as field,
  brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->>'base_rules_count' as value
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

SELECT 
  'VOICE ARCHETYPE' as section,
  'Location Context Weight' as field,
  brand_profile_v5->'layer_0_intelligence'->'voice_archetype'->>'location_context_weight' as value
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

ORDER BY section, field;
