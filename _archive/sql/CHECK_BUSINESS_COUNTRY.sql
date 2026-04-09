-- Check business country from business_locations
SELECT 
  bl.business_id,
  bl.country,
  bl.city,
  bl.postal_code,
  b.name as business_name,
  b.primary_language
FROM business_locations bl
JOIN businesses b ON b.id = bl.business_id
WHERE b.owner_id = '79240eba-2651-445c-8d4c-aaead7d06d9e';
