-- Check extraction results for Cafe Faust test
-- business_id: ac838e1d-571a-4aeb-8a3e-00fe0b0903b0

-- 1. Business table
SELECT 
  business_name,
  local_location_reference,
  website_url,
  updated_at
FROM businesses 
WHERE id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0';

-- 2. Business profile
SELECT 
  user_about_text,
  key_offerings,
  ai_place_synopsis,
  menu_description
FROM business_profile 
WHERE business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0';

-- 3. Business locations
SELECT 
  address_line1,
  postal_code,
  phone,
  email
FROM business_locations 
WHERE business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0';

-- 4. Latest scrape result
SELECT 
  scraped_at,
  (payload->'extraction'->'quality'->>'rating') as quality,
  (payload->'extraction'->'business'->'name'->>'value') as scraped_name
FROM website_scrape_results 
WHERE business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0'
ORDER BY scraped_at DESC 
LIMIT 1;
