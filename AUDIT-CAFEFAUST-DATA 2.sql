-- Audit ALL data available for Café Faust
-- Find what's in database vs what persona is missing

-- 1. Business core data
SELECT 
  id,
  name,
  vertical,
  country,
  website_url,
  primary_language
FROM businesses
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. Business operations / opening hours
SELECT *
FROM business_operations
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 3. Menu items (normalized table)
SELECT 
  item_name,
  item_description,
  item_price,
  category_name,
  service_period_name,
  menu_title
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY item_price DESC NULLS LAST
LIMIT 10;

-- 4. Business programme profiles (already being used)
SELECT 
  programme_type,
  time_window,
  days_of_week,
  confidence
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 5. Business locations
SELECT 
  location_name,
  location_descriptor,
  postal_code,
  city
FROM business_locations
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
