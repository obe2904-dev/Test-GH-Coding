-- Check nearby POIs for restaurantvaldemar to verify university proximity
SELECT 
  b.name,
  bli.formatted_address,
  bli.landmarks_nearby
FROM businesses b
JOIN business_location_intelligence bli ON b.id = bli.business_id
WHERE b.id = '1a285371-64f7-4def-b248-2e8cdfbba106';
