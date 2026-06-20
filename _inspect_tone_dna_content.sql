-- Inspect actual Tone DNA content for Café Faust
SELECT 
  -- Strategic recommendation
  brand_profile_v5->'voice'->'tone_dna'->'recommended_tone'->>'tone_positioning' as tone_positioning,
  brand_profile_v5->'voice'->'tone_dna'->'recommended_tone'->>'why_optimal' as why_optimal,
  brand_profile_v5->'voice'->'tone_dna'->'recommended_tone'->>'confidence_score' as confidence,
  
  -- Location driver
  brand_profile_v5->'voice'->'tone_dna'->'location_driver'->>'primary_dimension' as location_driver,
  brand_profile_v5->'voice'->'tone_dna'->'location_driver'->>'score' as location_score,
  brand_profile_v5->'voice'->'tone_dna'->'location_driver'->>'strategic_importance' as strategic_importance,
  
  -- Culinary character
  brand_profile_v5->'voice'->'tone_dna'->'culinary_character'->>'price_positioning' as price_positioning,
  brand_profile_v5->'voice'->'tone_dna'->'culinary_character'->>'formality_requirement' as formality,
  
  -- Owner voice
  brand_profile_v5->'voice'->'tone_dna'->'owner_voice'->>'register_level' as owner_register,
  brand_profile_v5->'voice'->'tone_dna'->'owner_voice'->'detected_adjectives' as owner_adjectives,
  
  -- Market context
  brand_profile_v5->'voice'->'tone_dna'->'market_context'->>'cultural_norms' as cultural_norms,
  
  -- Strategic summary
  brand_profile_v5->'voice'->'tone_dna'->>'strategic_summary' as strategic_summary,
  
  -- Example counts
  jsonb_array_length(brand_profile_v5->'voice'->'enhanced_social_examples') as social_examples_count,
  jsonb_array_length(brand_profile_v5->'voice'->'enhanced_avoid_examples') as avoid_examples_count

FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Sample one enhanced social example to see the reasoning structure
SELECT 
  ex->>'text' as example_text,
  ex->'why_it_works' as reasoning,
  ex->'tone_elements_demonstrated' as tone_elements,
  ex->>'content_type' as content_type,
  ex->>'programme' as programme
FROM business_brand_profile,
  jsonb_array_elements(brand_profile_v5->'voice'->'enhanced_social_examples') as ex
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
LIMIT 3;

-- Sample one avoid example to see the failure reasoning
SELECT 
  ex->>'text' as bad_example_text,
  ex->'why_it_fails' as failure_reasons,
  ex->>'failure_mode' as failure_mode
FROM business_brand_profile,
  jsonb_array_elements(brand_profile_v5->'voice'->'enhanced_avoid_examples') as ex
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
LIMIT 2;

-- Check the DO and DON'T lists
SELECT 
  jsonb_pretty(brand_profile_v5->'voice'->'tone_dna'->'tone_do_list') as tone_do_list,
  jsonb_pretty(brand_profile_v5->'voice'->'tone_dna'->'tone_dont_list') as tone_dont_list
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
