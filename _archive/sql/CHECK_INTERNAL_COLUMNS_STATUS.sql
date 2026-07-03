-- Check if internal columns exist
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'business_location_intelligence'
  AND column_name IN ('who_analysis', 'when_analysis', 'why_analysis', 'who_analysis_internal', 'when_analysis_internal', 'why_analysis_internal')
ORDER BY column_name;

-- Check actual data for recent entry
SELECT 
  business_id,
  who_analysis IS NOT NULL as has_who_public,
  who_analysis_internal IS NOT NULL as has_who_internal,
  jsonb_array_length(COALESCE(who_analysis, '[]'::jsonb)) as who_public_count,
  jsonb_array_length(COALESCE(who_analysis_internal, '[]'::jsonb)) as who_internal_count,
  updated_at
FROM business_location_intelligence
WHERE business_id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8';
