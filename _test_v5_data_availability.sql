-- V5 Data Availability Test for Café Faust
-- Purpose: Validate which fields are populated in V5 vs flat columns
-- Subject: business_id 36e24a84-c32d-4123-910a-1bb2e64d34af

SELECT 
  -- === FLAT COLUMNS (EXPECT NULL AFTER V5) ===
  brand_essence as flat_brand_essence,
  positioning as flat_positioning,
  core_values as flat_core_values,
  what_makes_us_different as flat_usp,
  tone_of_voice as flat_tone_of_voice,
  voice_rationale as flat_voice_rationale,
  communication_goal as flat_comm_goal,
  content_focus as flat_content_focus,
  core_offerings as flat_offerings,
  
  -- === V5 IDENTITY PATHS (EXPECT POPULATED) ===
  brand_profile_v5->'identity'->>'brand_essence' as v5_essence,
  brand_profile_v5->'identity'->>'positioning' as v5_positioning,
  brand_profile_v5->'identity'->'core_values' as v5_core_values,
  brand_profile_v5->'identity'->>'what_makes_us_different' as v5_usp,
  brand_profile_v5->'identity'->>'identity_reasoning' as v5_reasoning,
  
  -- === V5 VOICE PATHS (EXPECT POPULATED) ===
  brand_profile_v5->'voice'->'tone_rules' as v5_tone_rules,
  brand_profile_v5->'voice'->>'voice_reasoning' as v5_voice_reasoning,
  brand_profile_v5->'voice'->>'formality_level' as v5_formality,
  brand_profile_v5->'voice'->>'emoji_usage' as v5_emoji,
  
  -- === V5 LOCATION (EXPECT POPULATED) ===
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'city' as v5_city,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'area_type' as v5_area_type,
  brand_profile_v5->'layer_0_intelligence'->'geographic_context'->>'narrative' as v5_location_narrative,
  
  -- === FLATTENED V5 COLUMNS (EXPECT POPULATED) ===
  CASE 
    WHEN business_identity_persona IS NOT NULL THEN 'POPULATED'
    ELSE 'NULL'
  END as flattened_persona_status,
  
  CASE 
    WHEN marketing_manager_brief IS NOT NULL THEN 'POPULATED'
    ELSE 'NULL'
  END as flattened_brief_status,
  
  CASE 
    WHEN voice_guardrails IS NOT NULL THEN 'POPULATED'
    ELSE 'NULL'
  END as flattened_guardrails_status,
  
  CASE 
    WHEN strategic_audience_segments IS NOT NULL THEN 'POPULATED'
    ELSE 'NULL'
  END as flattened_audiences_status,
  
  -- === METADATA ===
  brand_profile_v5_generated_at,
  brand_profile_v5_version,
  
  -- === V5 STRUCTURE CHECK ===
  jsonb_typeof(brand_profile_v5) as v5_type,
  jsonb_typeof(brand_profile_v5->'identity') as v5_identity_type,
  jsonb_typeof(brand_profile_v5->'voice') as v5_voice_type,
  jsonb_typeof(brand_profile_v5->'layer_0_intelligence') as v5_layer0_type
  
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';
