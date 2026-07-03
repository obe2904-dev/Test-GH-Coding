-- ============================================================================
-- CHECK LOCATION DATA FOR CAFÉ FAUST
-- ============================================================================

WITH my_business AS (
  SELECT id FROM businesses 
  WHERE owner_id IN (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1)
)
SELECT 
  'Location Data' as info,
  bl.id,
  bl.business_id,
  bl.label,
  bl.address_line1,
  bl.address_line2,
  bl.postal_code,
  bl.city,
  bl.country,
  bl.maps_url,
  bl.phone,
  bl.email,
  bl.is_primary,
  bl.created_at,
  CASE 
    WHEN bl.address_line1 IS NOT NULL OR bl.city IS NOT NULL THEN '✓ Has address data'
    ELSE '✗ Empty location row (should not show checkmark)'
  END as should_show_checkmark
FROM business_locations bl
INNER JOIN my_business mb ON bl.business_id = mb.id;

-- Also check if row exists but is empty
WITH my_business AS (
  SELECT id FROM businesses 
  WHERE owner_id IN (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1)
)
SELECT 
  'Row count' as info,
  COUNT(*) as total_rows,
  COUNT(address_line1) as rows_with_address,
  COUNT(city) as rows_with_city
FROM business_locations bl
INNER JOIN my_business mb ON bl.business_id = mb.id;
