-- Deep diagnostic: Check what was actually generated
-- The UI says "4 programmes" but our queries show null - let's see what's really there

-- 1. Check the full brand_profile_v5 structure
SELECT 
  business_id,
  jsonb_pretty(brand_profile_v5) as full_profile
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Too big? Try this instead:

-- 2. Check layer by layer
SELECT 
  business_id,
  brand_profile_v5 ? 'layer_0_intelligence' as has_layer_0,
  brand_profile_v5 ? 'layer_1_programmes' as has_layer_1,
  brand_profile_v5 ? 'layer_2_commercial' as has_layer_2,
  brand_profile_v5 ? 'layer_3_identity' as has_layer_3,
  brand_profile_v5 ? 'layer_4_audience' as has_layer_4,
  brand_profile_v5 ? 'voice' as has_voice,
  brand_profile_v5->'voice' ? 'tone_dna' as voice_has_tone_dna
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 3. Check if programmes are in layer_1_programmes OR somewhere else
SELECT 
  business_id,
  jsonb_typeof(brand_profile_v5->'layer_1_programmes') as layer1_type,
  CASE 
    WHEN jsonb_typeof(brand_profile_v5->'layer_1_programmes') = 'array' 
    THEN jsonb_array_length(brand_profile_v5->'layer_1_programmes')
    ELSE NULL
  END as programme_count,
  brand_profile_v5->'layer_1_programmes'->0->>'name' as first_programme_name
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 4. Check voice layer contents
SELECT 
  business_id,
  jsonb_object_keys(brand_profile_v5->'voice') as voice_field
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND brand_profile_v5->'voice' IS NOT NULL;

-- 5. Check for any error fields
SELECT 
  business_id,
  brand_profile_v5->'error' as error_field,
  brand_profile_v5->'voice'->'error' as voice_error
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
