-- Quick check after latest regeneration
SELECT 
  business_id,
  brand_profile_v5_generated_at,
  CASE 
    WHEN brand_profile_v5->'voice'->'menu_description_examples' IS NULL 
    THEN 'NULL'
    ELSE jsonb_array_length(brand_profile_v5->'voice'->'menu_description_examples')::text || ' examples'
  END as examples_status,
  jsonb_pretty(brand_profile_v5->'voice'->'menu_description_examples') as examples
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
