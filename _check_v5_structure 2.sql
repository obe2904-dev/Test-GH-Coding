-- Check actual structure of brand_profile_v5
SELECT 
  jsonb_object_keys(brand_profile_v5) as top_level_keys
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
