-- Check NEW social writing examples after regeneration
SELECT 
  jsonb_pretty(brand_profile_v5->'voice'->'social_writing_examples') as social_examples
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
