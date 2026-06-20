-- Check all columns in business_brand_profile
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_brand_profile'
ORDER BY ordinal_position;

-- Check if v5 column exists
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_brand_profile'
  AND column_name LIKE '%v5%';
