-- ============================================================================
-- VERIFY CAFE FAUST HYBRID STATUS
-- ============================================================================
-- Check that Cafe Faust has multiple programmes detected in V5
-- ============================================================================

-- 1. Check businesses table vertical
SELECT 
  id,
  name,
  vertical,
  local_location_reference
FROM businesses
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. Check V5 brand profile programmes array (source of truth for hybrid detection)
SELECT 
  business_id,
  (brand_profile_v5->'programmes')::jsonb AS programmes,
  jsonb_array_length(brand_profile_v5->'programmes') AS programme_count,
  brand_profile_v5->'business_model'->>'business_type' AS business_type
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 3. Extract programme names for readability
SELECT 
  business_id,
  jsonb_array_elements(brand_profile_v5->'programmes')->>'name' AS programme_name,
  jsonb_array_elements(brand_profile_v5->'programmes')->>'confidence' AS confidence
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Expected result: Multiple programmes (e.g., dining, drinks, events, brunch, etc.)
-- indicating hybrid F&B operations
