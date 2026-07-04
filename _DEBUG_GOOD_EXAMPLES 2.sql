-- Debug why good_examples is null

-- Check if enhanced_social_examples has data
SELECT 
  'Enhanced Social Examples' AS check,
  jsonb_array_length(enhanced_social_examples) AS count,
  jsonb_pretty(enhanced_social_examples) AS data
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- Check current writing_examples structure
SELECT 
  'Writing Examples Structure' AS check,
  jsonb_pretty(brand_profile_v5->'voice'->'writing_examples') AS current_structure
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- Test the extraction logic
SELECT 
  'Test Extraction' AS check,
  jsonb_agg(example->>'text') AS extracted_texts
FROM (
  SELECT example
  FROM business_brand_profile,
  LATERAL jsonb_array_elements(enhanced_social_examples) AS example
  WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af'
  LIMIT 5
) AS limited_examples;
