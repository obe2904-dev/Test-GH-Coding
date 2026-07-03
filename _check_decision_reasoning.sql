-- Check decision_timing reasoning from V5 generator
SELECT 
  programme_name,
  decision_timing,
  baseline_goal_split,
  reasoning,
  created_at
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC
LIMIT 10;
