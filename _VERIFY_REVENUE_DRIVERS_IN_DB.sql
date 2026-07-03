-- ============================================================================
-- VERIFY: Revenue Drivers Exist in Database
-- ============================================================================
-- Purpose: Confirm revenue_drivers were populated and check structure

-- Check if revenue_drivers exist for Cafe Faust
SELECT 
  'Revenue Drivers Existence Check' as test_name,
  business_id,
  CASE 
    WHEN brand_profile_v5->'revenue_drivers' IS NOT NULL THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status,
  jsonb_typeof(brand_profile_v5->'revenue_drivers') as data_type,
  (brand_profile_v5->'revenue_drivers'->>'primary_revenue_moment')::text as primary_moment,
  jsonb_array_length(brand_profile_v5->'revenue_drivers'->'secondary_revenue_moments') as secondary_count
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Display full revenue drivers structure
SELECT 
  'Revenue Drivers Full Structure' as test_name,
  jsonb_pretty(brand_profile_v5->'revenue_drivers') as revenue_drivers_formatted
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Extract preferred day pattern
SELECT 
  'Preferred Day Pattern' as test_name,
  jsonb_array_elements_text(brand_profile_v5->'revenue_drivers'->'preferred_day_pattern') as preferred_day,
  ROW_NUMBER() OVER () as priority
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Extract all revenue moments (primary + secondary)
SELECT 
  'All Revenue Moments' as test_name,
  'primary' as moment_type,
  brand_profile_v5->'revenue_drivers'->'primary_revenue_moment'->>'service_type' as service_type,
  brand_profile_v5->'revenue_drivers'->'primary_revenue_moment'->>'decision_pattern' as decision_pattern,
  jsonb_array_length(brand_profile_v5->'revenue_drivers'->'primary_revenue_moment'->'decision_windows') as decision_windows_count
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

SELECT 
  'All Revenue Moments' as test_name,
  'secondary' as moment_type,
  moment->>'service_type' as service_type,
  moment->>'decision_pattern' as decision_pattern,
  jsonb_array_length(moment->'decision_windows') as decision_windows_count
FROM business_brand_profile,
  jsonb_array_elements(brand_profile_v5->'revenue_drivers'->'secondary_revenue_moments') as moment
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
