-- Check raw menu_description_examples data
SELECT 
  jsonb_pretty(brand_profile_v5->'voice'->'menu_description_examples') as examples
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
