-- ============================================================================
-- TEST LOCAL_LOCATION_REFERENCE INTEGRATION
-- ============================================================================
-- Verify local_location_reference is set for Cafe Faust and ready for testing
-- ============================================================================

-- 1. Confirm Cafe Faust has local_location_reference set
SELECT 
  id,
  name,
  vertical,
  local_location_reference,
  created_at
FROM businesses
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. Check V5 brand profile exists and has programmes
SELECT 
  business_id,
  jsonb_array_length(brand_profile_v5->'programmes') AS programme_count,
  brand_profile_v5->'business_model'->>'business_type' AS business_type,
  (brand_profile_v5->'programmes'->0->>'name') AS first_programme,
  (brand_profile_v5->'programmes'->1->>'name') AS second_programme,
  updated_at
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 3. Check if there are recent AI suggestions to test with
SELECT 
  id,
  title,
  content_type,
  timing_day,
  created_at
FROM ai_content_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND status = 'pending'
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- EXPECTED RESULTS
-- ============================================================================
-- Query 1: Should show local_location_reference = 'ved åen'
-- Query 2: Should show multiple programmes (2+) indicating hybrid status
-- Query 3: Should show recent suggestions available for testing
-- ============================================================================

-- TEST PLAN:
-- 1. Use CreatePostPage (write mode or AI ideas mode) to generate content
-- 2. Check Edge Function logs for "📍 Location context: ved åen (local reference)"
-- 3. Verify generated caption includes "ved åen" in natural context
-- 4. Confirm prompt shows "Cafe Faust ved åen (effectiveVertical)" not "i Aarhus"
