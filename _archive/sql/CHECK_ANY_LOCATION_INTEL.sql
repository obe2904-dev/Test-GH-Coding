-- Check if any location intelligence exists
SELECT 
  business_id,
  neighborhood,
  who_analysis IS NOT NULL as has_who_public,
  who_analysis_internal IS NOT NULL as has_who_internal,
  jsonb_array_length(COALESCE(who_analysis, '[]'::jsonb)) as who_public_count,
  jsonb_array_length(COALESCE(who_analysis_internal, '[]'::jsonb)) as who_internal_count,
  created_at,
  updated_at
FROM business_location_intelligence
ORDER BY updated_at DESC
LIMIT 5;
