-- ============================================================================
-- FIX INVALID AREA_TYPE VALUES
-- ============================================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- URL: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
-- ============================================================================
-- ISSUE: Old schema stored demographic data ("student", "tourist") in area_type
-- Migration 20260522000002 cleaned category_scores but missed area_type
-- ============================================================================

-- Step 1: Show all businesses with invalid area_type
SELECT 
  b.id,
  b.name,
  bl.city,
  bli.neighborhood,
  bli.area_type AS invalid_area_type,
  bli.demographic_proximity,
  bli.last_updated_by_ai
FROM business_location_intelligence bli
JOIN businesses b ON bli.business_id = b.id
LEFT JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
WHERE bli.area_type NOT IN (
  'city_centre', 'residential', 'office', 'transport_hub',
  'waterfront', 'shopping_district', 'mixed_use', 'destination', 'nature_park'
)
OR bli.area_type IS NULL
ORDER BY bli.last_updated_by_ai DESC;

-- Step 2: Fix invalid area_type values
-- Set to 'mixed_use' as a safe default
UPDATE business_location_intelligence
SET 
  area_type = 'mixed_use',
  last_updated_by_ai = NOW()
WHERE area_type NOT IN (
  'city_centre', 'residential', 'office', 'transport_hub',
  'waterfront', 'shopping_district', 'mixed_use', 'destination', 'nature_park'
)
OR area_type IS NULL;

-- Step 3: Verify the fix
SELECT 
  COUNT(*) AS total_fixed,
  COUNT(CASE WHEN area_type = 'mixed_use' THEN 1 END) AS set_to_mixed_use
FROM business_location_intelligence
WHERE last_updated_by_ai >= NOW() - INTERVAL '1 minute';

-- Step 4: Check specific business
SELECT 
  b.name,
  bl.city,
  bli.neighborhood,
  bli.area_type,
  bli.category_scores,
  bli.demographic_proximity
FROM business_location_intelligence bli
JOIN businesses b ON bli.business_id = b.id
JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
WHERE bli.business_id = '95d657ad-d791-422b-ad40-ec7a5f1c2b0c';

-- ============================================================================
-- EXPECTED RESULTS:
-- - KOREAN BBQ & SUSHI should have area_type = 'mixed_use'
-- - neighborhood should still be 'Aarhus' (wrong - will be fixed by Edge Function refresh)
-- ============================================================================
