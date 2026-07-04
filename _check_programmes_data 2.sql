-- Check where signature_themes data exists in the database

-- Option 1: In brand_profile_v5 JSON under programmes
SELECT 
  'brand_profile_v5 programmes' as source,
  jsonb_pretty(brand_profile_v5->'programmes') as programmes_data
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
LIMIT 1;
