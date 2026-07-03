-- Check actual baseline_goal_split for Cafe Faust programmes
SELECT 
  programme_type,
  programme_name,
  baseline_goal_split,
  (baseline_goal_split->>'drive_footfall')::float AS footfall_pct,
  (baseline_goal_split->>'build_brand')::float AS brand_pct,
  (baseline_goal_split->>'retain_loyalty')::float AS loyalty_pct
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY programme_type;
