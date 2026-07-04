-- Check menu_description_examples after regeneration (V5.3 format: 6 examples, 2 per dish)
SELECT 
  jsonb_array_length(brand_profile_v5->'voice'->'menu_description_examples') as example_count,
  brand_profile_v5->'voice'->'menu_description_examples'->0 as dish_1_variation_a,
  brand_profile_v5->'voice'->'menu_description_examples'->1 as dish_1_variation_b,
  brand_profile_v5->'voice'->'menu_description_examples'->2 as dish_2_variation_a,
  brand_profile_v5->'voice'->'menu_description_examples'->3 as dish_2_variation_b,
  brand_profile_v5->'voice'->'menu_description_examples'->4 as dish_3_variation_a,
  brand_profile_v5->'voice'->'menu_description_examples'->5 as dish_3_variation_b
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Check language detection metadata
SELECT 
  brand_profile_v5->'voice'->'menu_description_metadata'->>'origin_mention_frequency' as frequency,
  brand_profile_v5->'voice'->'menu_description_metadata'->>'origin_mention_reasoning' as reasoning,
  brand_profile_v5->'voice'->'menu_description_metadata'->'detected_origin_keywords' as keywords
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Pretty print for readability
SELECT 
  jsonb_pretty(brand_profile_v5->'voice'->'menu_description_examples') as examples
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
