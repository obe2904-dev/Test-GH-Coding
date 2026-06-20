-- Check audience segments with decision_timing per segment
SELECT 
  programme_name,
  decision_timing as programme_decision_timing,
  jsonb_pretty(audience_segments) as segments_detail
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC;

-- Extract individual segments
SELECT 
  programme_name,
  seg->>'name' as segment_name,
  seg->>'is_primary' as is_primary,
  seg->>'decision_timing' as segment_decision_timing,
  seg->>'motivation' as motivation,
  seg->>'size_estimate' as size_estimate
FROM business_programme_profiles,
  jsonb_array_elements(audience_segments) as seg
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY programme_name, (seg->>'is_primary')::boolean DESC;
