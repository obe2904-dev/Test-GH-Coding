-- Check existing baseline_goal_split data for business 768890fd-1c3b-4309-95c4-7451e5906197

SELECT 
  programme_type,
  baseline_goal_split,
  jsonb_object_keys(baseline_goal_split) as goal_keys,
  (baseline_goal_split->>'drive_footfall')::numeric as drive_footfall,
  (baseline_goal_split->>'strengthen_brand')::numeric as strengthen_brand,
  (baseline_goal_split->>'retain_regulars')::numeric as retain_regulars
FROM business_programme_profiles
WHERE business_id = '768890fd-1c3b-4309-95c4-7451e5906197'
ORDER BY programme_type;
