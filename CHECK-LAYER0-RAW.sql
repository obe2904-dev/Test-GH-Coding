-- ============================================================================
-- RAW LAYER 0 DATA CHECK
-- ============================================================================
-- Check if layer_0_intelligence exists and what it contains
-- ============================================================================

-- 1. Does layer_0_intelligence exist at all?
SELECT 
  'Layer 0 Exists?' as check_type,
  CASE 
    WHEN brand_profile_v5->'layer_0_intelligence' IS NOT NULL THEN 'YES'
    ELSE 'NO'
  END as exists,
  jsonb_typeof(brand_profile_v5->'layer_0_intelligence') as data_type,
  jsonb_object_keys(brand_profile_v5->'layer_0_intelligence') as top_level_keys
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. What keys exist in layer_0_intelligence?
SELECT 
  'Available Keys' as check_type,
  jsonb_object_keys(brand_profile_v5->'layer_0_intelligence') as key_name
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 3. Check business_type specifically
SELECT 
  'Business Type Check' as check_type,
  brand_profile_v5->'layer_0_intelligence'->'business_type' as business_type_data,
  jsonb_typeof(brand_profile_v5->'layer_0_intelligence'->'business_type') as data_type
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 4. Check professional_persona specifically
SELECT 
  'Professional Persona Check' as check_type,
  brand_profile_v5->'layer_0_intelligence'->'professional_persona' as persona_data,
  jsonb_typeof(brand_profile_v5->'layer_0_intelligence'->'professional_persona') as data_type
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 5. Check voice_archetype specifically
SELECT 
  'Voice Archetype Check' as check_type,
  brand_profile_v5->'layer_0_intelligence'->'voice_archetype' as archetype_data,
  jsonb_typeof(brand_profile_v5->'layer_0_intelligence'->'voice_archetype') as data_type
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
