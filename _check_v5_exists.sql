-- Check if brand_profile_v5 column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_brand_profile'
  AND column_name = 'brand_profile_v5';
