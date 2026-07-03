-- Check business_brand_profile table for description fields
SELECT
  business_id,
  brand_profile_v5 -> 'identity' ->> 'business_description' as v5_business_description,
  brand_essence_elaboration
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Check businesses table structure
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'businesses'
ORDER BY ordinal_position;
