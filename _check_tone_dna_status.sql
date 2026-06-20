-- Check if Tone DNA fields exist in voice layer
SELECT 
  business_id,
  brand_profile_v5->'voice' ? 'tone_dna' as has_tone_dna,
  brand_profile_v5->'voice' ? 'enhanced_social_examples' as has_enhanced_social,
  brand_profile_v5->'voice' ? 'enhanced_avoid_examples' as has_enhanced_avoid,
  -- Check if old fields exist (they should)
  brand_profile_v5->'voice' ? 'tone_rules' as has_tone_rules,
  brand_profile_v5->'voice' ? 'social_writing_examples' as has_social_examples,
  -- Get voice field count
  (SELECT COUNT(*) FROM jsonb_object_keys(brand_profile_v5->'voice')) as voice_field_count
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Also check when it was last generated
SELECT 
  business_id,
  brand_profile_v5_generated_at,
  brand_profile_v5->>'version' as version,
  brand_profile_v5->'generation_metadata'->>'duration_ms' as duration_ms,
  brand_profile_v5->'generation_metadata'->>'request_id' as request_id
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
