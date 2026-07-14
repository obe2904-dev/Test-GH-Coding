-- Verify what data was scraped and distributed for business
-- Run this after website analysis to see all extracted data
-- business_id: ac838e1d-571a-4aeb-8a3e-00fe0b0903b0

-- 1. Latest scrape result
SELECT 
  id as scrape_id,
  created_at,
  source_url,
  content_quality,
  extracted_at,
  (scraper_payload -> 'extraction' -> 'quality' ->> 'rating') as scraper_quality,
  (scraper_payload -> 'extraction' -> 'quality' ->> 'fields_found') as fields_found,
  extracted_data
FROM website_scrape_results
WHERE business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0'
ORDER BY created_at DESC
LIMIT 1;

-- 2. Business info
SELECT 
  name as business_name,
  website_url,
  last_scraped_at
FROM businesses
WHERE id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0';

-- 3. Business profile (AI extracted + URLs)
SELECT 
  user_about_text,
  long_description,
  key_offerings,
  menu_signal,
  business_keywords,
  brand_tone,
  booking_url,
  takeaway_url,
  google_maps_url,
  food_inspection_url,
  social_profiles
FROM business_profile
WHERE business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0';

-- 4. Contact info
SELECT 
  email,
  phone,
  address_line1,
  postal_code,
  city,
  is_primary
FROM business_locations
WHERE business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0';

-- 5. Opening hours
SELECT 
  weekday,
  open_time,
  close_time,
  kind
FROM opening_hours
WHERE business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0'
ORDER BY 
  CASE weekday
    WHEN 'monday' THEN 1
    WHEN 'tuesday' THEN 2
    WHEN 'wednesday' THEN 3
    WHEN 'thursday' THEN 4
    WHEN 'friday' THEN 5
    WHEN 'saturday' THEN 6
    WHEN 'sunday' THEN 7
  END;

-- 6. Social accounts
SELECT 
  platform,
  handle,
  profile_url,
  is_connected
FROM social_accounts
WHERE business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0';

-- 7. Menu sources
SELECT 
  source_url,
  source_type,
  is_active,
  discovered_at
FROM menu_sources
WHERE business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0';

-- 8. Service model
SELECT 
  has_table_service,
  has_takeaway,
  has_delivery,
  has_outdoor_seating,
  has_wifi,
  has_power_outlets,
  has_parking,
  reservation_required,
  has_kids_menu
FROM business_operations
WHERE business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0';
