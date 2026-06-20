-- ============================================================================
-- SET LOCAL LOCATION REFERENCE FOR CAFE FAUST (TESTING)
-- ============================================================================
-- Cafe Faust is located at Åboulevarden (by the river/stream "åen" in Aarhus)
-- The authentic local term is "ved åen" (by the river), not "ved vandet" (by the water)
-- ============================================================================

UPDATE business_location_intelligence
SET local_location_reference = 'ved åen'
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Verify the update
SELECT 
  business_id,
  city,
  neighborhood,
  area_type,
  local_location_reference,
  last_updated_by_ai
FROM business_location_intelligence
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
