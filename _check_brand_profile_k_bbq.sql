-- Check brand profile for K-BBQ (de06238f-6b50-48db-8a02-0fb228eda9f1)
SELECT 
  business_id,
  tone_of_voice,
  voice_constraints,
  things_to_avoid,
  brand_profile_v5->'voice'->'tone_rules' as tone_rules,
  brand_profile_v5->'voice'->'personality_traits' as personality_traits,
  brand_profile_v5->'voice'->'formality_level' as formality_level,
  brand_profile_v5->'voice'->'humor_style' as humor_style,
  brand_profile_v5->'voice'->'sentence_structure' as sentence_structure,
  length(tone_of_voice::text) as tone_of_voice_length,
  length(voice_constraints::text) as voice_constraints_length,
  enhanced_social_examples,
  social_writing_examples,
  brand_profile_v5_generated_at
FROM business_brand_profile
WHERE business_id = 'de06238f-6b50-48db-8a02-0fb228eda9f1';
