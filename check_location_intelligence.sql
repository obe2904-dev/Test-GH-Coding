-- Verify location intelligence was saved
SELECT 
  business_id,
  neighborhood,
  area_type,
  latitude,
  longitude,
  location_marketing_hooks,
  jsonb_array_length(landmarks_nearby) as landmarks_count,
  last_updated_by_ai,
  created_at,
  updated_at
FROM business_location_intelligence
WHERE business_id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8';

-- View all landmarks in detail
SELECT 
  business_id,
  jsonb_pretty(landmarks_nearby) as landmarks
FROM business_location_intelligence
WHERE business_id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8';

-- Check public transport data
SELECT 
  business_id,
  jsonb_pretty(public_transport) as transport
FROM business_location_intelligence
WHERE business_id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8';
