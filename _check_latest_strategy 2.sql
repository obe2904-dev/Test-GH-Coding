-- Check if a NEW strategy was created after our deployment
SELECT 
  week_number,
  week_start,
  generated_at,
  status,
  (week_context_snapshot->>'booking_link') as booking_link,
  (week_context_snapshot->'cta_rules'->>'mode') as cta_mode
FROM weekly_strategies
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND week_number = 26
ORDER BY generated_at DESC
LIMIT 3;
