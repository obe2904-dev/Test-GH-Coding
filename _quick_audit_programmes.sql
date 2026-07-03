-- Quick verification of business_programme_profiles for Cafe Faust
SELECT 
  programme_name,
  programme_type,
  start_time,
  end_time,
  baseline_goal_split,
  decision_timing_mode,
  commercial_reasoning,
  jsonb_array_length(audience_segments) as segment_count
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY programme_name;
