-- Verify booking data is now in weekly_strategies.week_context_snapshot
SELECT 
  week_number,
  week_start,
  generated_at,
  (week_context_snapshot->>'booking_link') as booking_link,
  (week_context_snapshot->'booking_model'->>'has_booking_link')::boolean as has_booking_link,
  (week_context_snapshot->'booking_model'->>'accepts_walk_ins')::boolean as accepts_walk_ins,
  (week_context_snapshot->'booking_model'->>'reservation_required')::boolean as reservation_required,
  (week_context_snapshot->'cta_rules'->>'mode') as cta_mode,
  (week_context_snapshot->'cta_rules'->>'booking_nudge_capable')::boolean as booking_nudge_capable,
  (week_context_snapshot->'cta_rules'->'booking_nudge_lead_days')::int as booking_nudge_lead_days
FROM weekly_strategies
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND week_number = 26
ORDER BY generated_at DESC
LIMIT 1;
