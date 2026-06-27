-- Check has_outdoor_seating value for business
SELECT 
  b.id,
  b.name,
  bo.has_outdoor_seating,
  CASE 
    WHEN bo.has_outdoor_seating IS NULL THEN 'NULL'
    WHEN bo.has_outdoor_seating = true THEN 'TRUE'
    WHEN bo.has_outdoor_seating = false THEN 'FALSE'
  END as outdoor_seating_status
FROM business b
LEFT JOIN business_operations bo ON bo.business_id = b.id
WHERE b.id = '69fabd28-83cd-4b60-859e-b1f80c387df9';
