-- Clear location intelligence for restaurantvaldemar to trigger re-analysis with new proximity logic
-- This will test the fix for student audience appearing when university is not actually nearby

-- First, let's see the current state
SELECT 
  b.id,
  b.username,
  bli.who,
  bli.category_scores,
  bli.demographic_proximity
FROM businesses b
LEFT JOIN business_location_intelligence bli ON b.id = bli.business_id
WHERE b.username = 'restaurantvaldemar';

-- Clear the location intelligence to trigger regeneration
DELETE FROM business_location_intelligence 
WHERE business_id IN (
  SELECT id FROM businesses WHERE username = 'restaurantvaldemar'
);

-- Verify deletion
SELECT 
  b.id,
  b.username,
  bli.id as location_intelligence_id
FROM businesses b
LEFT JOIN business_location_intelligence bli ON b.id = bli.business_id
WHERE b.username = 'restaurantvaldemar';
