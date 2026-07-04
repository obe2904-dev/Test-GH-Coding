-- ============================================================================
-- BACKFILL SYNTHESIZED NEIGHBORHOODS
-- ============================================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- URL: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
-- ============================================================================
-- PURPOSE: Synthesize neighborhood values for businesses where Google Maps
--          doesn't provide formal neighborhood data (rural areas, small towns,
--          regions without formal boundaries)
-- ============================================================================

-- Step 1: Check how many rows have null neighborhood
SELECT 
  COUNT(*) AS total_rows,
  COUNT(CASE WHEN neighborhood IS NULL THEN 1 END) AS null_neighborhoods,
  COUNT(CASE WHEN neighborhood IS NOT NULL THEN 1 END) AS has_neighborhood
FROM business_location_intelligence;

-- Step 2: Preview what will be synthesized
SELECT 
  b.name,
  bl.city,
  bli.neighborhood AS current_neighborhood,
  bli.area_type,
  CASE 
    WHEN bli.area_type = 'city_centre' THEN bl.city || ' centrum'
    WHEN bli.area_type = 'residential' THEN bl.city || ' boligområde'
    WHEN bli.area_type = 'office' THEN bl.city || ' erhvervsområde'
    WHEN bli.area_type = 'transport_hub' THEN bl.city || ' transportknudepunkt'
    WHEN bli.area_type = 'waterfront' THEN bl.city || ' havn'
    WHEN bli.area_type = 'shopping_district' THEN bl.city || ' shoppingområde'
    WHEN bli.area_type = 'mixed_use' THEN bl.city
    WHEN bli.area_type = 'destination' THEN bl.city || ' attraktion'
    WHEN bli.area_type = 'nature_park' THEN bl.city || ' naturområde'
    ELSE bl.city  -- Fallback to just city
  END AS synthesized_neighborhood
FROM business_location_intelligence bli
JOIN businesses b ON bli.business_id = b.id
LEFT JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
WHERE bli.neighborhood IS NULL
  AND bl.city IS NOT NULL
ORDER BY bl.city, bli.area_type;

-- Step 3: Apply the backfill
UPDATE business_location_intelligence bli
SET 
  neighborhood = CASE 
    WHEN bli.area_type = 'city_centre' THEN bl.city || ' centrum'
    WHEN bli.area_type = 'residential' THEN bl.city || ' boligområde'
    WHEN bli.area_type = 'office' THEN bl.city || ' erhvervsområde'
    WHEN bli.area_type = 'transport_hub' THEN bl.city || ' transportknudepunkt'
    WHEN bli.area_type = 'waterfront' THEN bl.city || ' havn'
    WHEN bli.area_type = 'shopping_district' THEN bl.city || ' shoppingområde'
    WHEN bli.area_type = 'mixed_use' THEN bl.city
    WHEN bli.area_type = 'destination' THEN bl.city || ' attraktion'
    WHEN bli.area_type = 'nature_park' THEN bl.city || ' naturområde'
    ELSE bl.city  -- Fallback to just city
  END,
  last_updated_by_ai = NOW()
FROM businesses b
LEFT JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
WHERE bli.business_id = b.id
  AND bli.neighborhood IS NULL
  AND bl.city IS NOT NULL;

-- Step 4: Verify the backfill
SELECT 
  COUNT(*) AS total_updated,
  COUNT(CASE WHEN neighborhood LIKE '% centrum' THEN 1 END) AS city_centre,
  COUNT(CASE WHEN neighborhood LIKE '% boligområde' THEN 1 END) AS residential,
  COUNT(CASE WHEN neighborhood LIKE '% havn' THEN 1 END) AS waterfront,
  COUNT(CASE WHEN neighborhood LIKE '% shoppingområde' THEN 1 END) AS shopping,
  COUNT(CASE WHEN neighborhood NOT LIKE '% %' THEN 1 END) AS city_only
FROM business_location_intelligence
WHERE last_updated_by_ai >= NOW() - INTERVAL '1 minute';

-- Step 5: Check for any remaining null neighborhoods
SELECT 
  b.name,
  bl.city,
  bli.neighborhood,
  bli.area_type
FROM business_location_intelligence bli
JOIN businesses b ON bli.business_id = b.id
LEFT JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
WHERE bli.neighborhood IS NULL
ORDER BY bl.city;

-- ============================================================================
-- EXPECTED RESULTS:
-- - All rows with null neighborhood should now have synthesized values
-- - Remaining nulls should only be businesses without city data
-- ============================================================================
