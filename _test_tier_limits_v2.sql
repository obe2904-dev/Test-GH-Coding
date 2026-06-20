-- Test tier limits for all plans
SELECT 
  'Free tier' as tier_name,
  regenerations_limit 
FROM get_daily_usage_stats(
  (SELECT id FROM businesses WHERE name = 'Cafe Faust' LIMIT 1),
  CURRENT_DATE
)
WHERE (SELECT plan FROM businesses WHERE name = 'Cafe Faust' LIMIT 1) = 'free'

UNION ALL

SELECT 
  'Smart tier (standardplus)' as tier_name,
  regenerations_limit
FROM get_daily_usage_stats(
  (SELECT id FROM businesses WHERE plan = 'standardplus' LIMIT 1),
  CURRENT_DATE
)
LIMIT 1;

-- Show current Cafe Faust status
SELECT 
  name,
  plan,
  quick_suggestions_today as regenerations_used,
  regenerations_limit
FROM businesses b
CROSS JOIN LATERAL (
  SELECT regenerations_limit 
  FROM get_daily_usage_stats(b.id, CURRENT_DATE)
) stats
WHERE name = 'Cafe Faust';
