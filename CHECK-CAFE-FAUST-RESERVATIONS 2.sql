-- Check current reservation settings for Cafe Faust
SELECT 
  business_id,
  reservations_enabled,
  reservations_type,
  reservations_url,
  online_ordering_enabled,
  online_ordering_url
FROM business_operations
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- Also check business profile for booking link
SELECT 
  business_id,
  booking_link,
  menu_link,
  instagram_handle
FROM business_profile
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
