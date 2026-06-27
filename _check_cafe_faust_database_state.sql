-- Check Café Faust's current database state
-- Business ID: 36e24a84-c32d-4123-910a-1bb2e64d34af

-- 1. Check if local_location_reference exists
SELECT 
  id,
  name,
  website_url,
  local_location_reference,
  created_at,
  updated_at
FROM businesses 
WHERE id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- 2. Check brand profile generation date
SELECT 
  business_id,
  brand_profile_v5->'voice'->'tone_dna'->'generated_at' as tone_dna_generated_at,
  brand_profile_v5->'voice'->'tone_dna'->'location_driver'->'natural_vocabulary' as natural_vocabulary,
  updated_at as profile_updated_at
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- 3. Check if location intelligence was populated
SELECT 
  business_id,
  local_location_reference,
  local_terminology,
  created_at,
  updated_at
FROM business_location_intelligence
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- 4. Full brand profile for context
SELECT 
  business_id,
  brand_profile_v5
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';
