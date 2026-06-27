-- Check if business_profile actually has data for this business
SELECT 
  business_id,
  menu_signal,
  booking_url,
  created_at,
  updated_at
FROM business_profile
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';
