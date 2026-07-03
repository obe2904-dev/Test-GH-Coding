-- Test if business_profile.booking_url can be retrieved
SELECT 
  bp.business_id,
  bp.booking_url,
  bo.accepts_walk_ins,
  bo.reservation_required,
  bo.has_table_service
FROM business_profile bp
LEFT JOIN business_operations bo ON bp.business_id = bo.business_id
WHERE bp.business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';
