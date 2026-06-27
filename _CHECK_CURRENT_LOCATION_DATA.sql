-- Check current location intelligence data after regeneration
SELECT 
  b.name AS business_name,
  bl.address_line1,
  bl.city AS db_city,
  bl.postal_code,
  bli.neighborhood AS current_neighborhood,
  bli.area_type AS current_area_type,
  bli.latitude,
  bli.longitude,
  bli.last_updated_by_ai,
  -- Validation checks
  CASE 
    WHEN bli.neighborhood ILIKE '%' || bl.city || '%' 
      OR bl.city ILIKE '%' || bli.neighborhood || '%'
    THEN '✅ MATCH'
    ELSE '❌ MISMATCH'
  END AS neighborhood_city_match,
  CASE 
    WHEN bli.area_type IN ('city_centre', 'residential', 'office', 'transport_hub',
                           'waterfront', 'shopping_district', 'mixed_use', 'destination', 'nature_park')
    THEN '✅ VALID'
    ELSE '❌ INVALID'
  END AS area_type_validation
FROM businesses b
JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
LEFT JOIN business_location_intelligence bli ON b.id = bli.business_id
WHERE b.id = '95d657ad-d791-422b-ad40-ec7a5f1c2b0c';
