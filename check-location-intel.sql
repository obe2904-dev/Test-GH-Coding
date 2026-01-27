-- Check what's in business_location_intelligence table
SELECT 
  business_id,
  neighborhood,
  location_type,
  nearby_landmarks,
  marketing_hooks,
  latitude,
  longitude,
  created_at,
  updated_at
FROM business_location_intelligence
WHERE business_id = (
  SELECT id FROM businesses WHERE name ILIKE '%aarhus%' OR name ILIKE '%cafe%'
  LIMIT 1
);

-- If that doesn't work, show all location intelligence records
SELECT * FROM business_location_intelligence;
