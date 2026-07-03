-- Check booking URL for Café Faust
SELECT 
  b.name,
  b.id,
  bp.booking_url,
  o.accepts_reservations,
  o.accepts_walk_ins,
  o.reservation_required
FROM business b
LEFT JOIN business_profile bp ON b.id = bp.business_id
LEFT JOIN business_operations o ON b.id = o.business_id
WHERE b.id = '36e24a84-c32d-4123-910a-1bb2e64d34af';
