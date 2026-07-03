-- Direct SQL query to check if programme profiles exist
-- Run this in Supabase SQL Editor

SELECT 
  business_id,
  programme_type,
  programme_name,
  confidence,
  jsonb_array_length(audience_segments) as segment_count,
  created_at,
  updated_at
FROM business_programme_profiles
WHERE business_id = '07b7a9f6-d2cf-4fa9-85af-714a8b294ea4'
ORDER BY programme_type;
