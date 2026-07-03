-- Check for any errors during brand profile generation
-- This will show if the regeneration completed successfully

-- 1. Check when the profile was last updated
SELECT 
  business_id,
  updated_at,
  brand_profile_v5 IS NOT NULL as has_v5_profile,
  brand_profile_v5->'generated_at' as v5_generated_at,
  brand_profile_v5->'version' as v5_version
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. Check if ANY layer was generated
SELECT 
  business_id,
  brand_profile_v5->'layer_0_intelligence' IS NOT NULL as has_layer_0,
  brand_profile_v5->'layer_1_programmes' IS NOT NULL as has_layer_1,
  brand_profile_v5->'layer_2_commercial' IS NOT NULL as has_layer_2,
  brand_profile_v5->'layer_3_identity' IS NOT NULL as has_layer_3,
  brand_profile_v5->'layer_4_audience' IS NOT NULL as has_layer_4,
  brand_profile_v5->'voice' IS NOT NULL as has_voice,
  brand_profile_v5->'voice'->'tone_dna' IS NOT NULL as has_tone_dna
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 3. Check what's actually in the voice layer
SELECT 
  business_id,
  jsonb_object_keys(brand_profile_v5->'voice') as voice_keys
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND brand_profile_v5->'voice' IS NOT NULL;

-- 4. Check for any error messages stored
SELECT 
  business_id,
  brand_profile_v5->'error' as generation_error,
  brand_profile_v5->'warnings' as generation_warnings
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
