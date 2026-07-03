-- Check programme profiles for this business
SELECT 
  programme_type,
  programme_name,
  is_active,
  time_windows,
  baseline_goal_split,
  created_at
FROM business_programme_profiles
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af'
ORDER BY programme_type;
