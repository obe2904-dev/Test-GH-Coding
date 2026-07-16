-- Check the most recent scrape for Souk
SELECT 
  id,
  business_id,
  scraped_at,
  content_quality,
  (extracted_data IS NOT NULL) as has_extraction,
  (extracted_data::text LIKE '%error%') as has_error,
  extracted_data
FROM website_scrape_results
WHERE business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0'
ORDER BY scraped_at DESC
LIMIT 1;

-- Check business profile data
SELECT 
  business_id,
  keywords,
  key_offerings,
  user_about_text,
  updated_at
FROM business_profile
WHERE business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0';

-- Check brand profile data  
SELECT 
  business_id,
  tone_of_voice,
  updated_at
FROM business_brand_profile
WHERE business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0';
