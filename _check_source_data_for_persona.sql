-- Deep-dive: Check all source data that feeds into the persona
-- Run in Supabase SQL Editor

-- 1. Menu Overview Summary (cross-menu intelligence)
SELECT 
  'MENU OVERVIEW SUMMARY' as source,
  menu_overview_summary->'cross_menu_summary' as cross_menu_summary,
  menu_overview_summary->'signature_themes' as signature_themes,
  gastronomic_profile
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. Location Intelligence 
SELECT 
  'LOCATION INTELLIGENCE' as source,
  neighborhood,
  neighborhood_character,
  area_type,
  category_scores,
  location_marketing_hooks,
  location_type_matches
FROM business_location_intelligence
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 3. Om Os text
SELECT 
  'OM OS' as source,
  long_description as om_os_text,
  length(long_description) as char_count
FROM business_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 4. Programme details
SELECT 
  'PROGRAMMES' as source,
  programme_type,
  programme_name,
  time_windows,
  operating_days
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY programme_type;
