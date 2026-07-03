-- Check Cafe Faust booking and walk-in settings
SELECT 
  business_id,
  name,
  reservation_required,
  accepts_walkins,
  kitchen_close_time,
  weekly_programme
FROM business_operations
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Also check locations table
SELECT 
  business_id,
  reservation_required
FROM business_locations
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
