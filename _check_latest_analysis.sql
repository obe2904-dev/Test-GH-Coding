-- Check what the latest analysis saved to database
-- Business ID: 450c1b6a-e354-4eef-88d8-86cd2ac8d42b

SELECT 
  -- From businesses table
  b.name as business_name,
  b.website_url,
  jsonb_pretty(b.business_type_hybrid) as business_type,
  b.updated_at as business_updated,
  
  -- From business_profile table
  bp.user_about_text,
  bp.long_description,
  bp.updated_at as profile_updated,
  
  -- From website_analyses table (raw analysis result)
  wa.raw_result->>'businessName' as analyzed_name,
  wa.raw_result->>'businessType' as analyzed_type,
  wa.raw_result->>'businessTypeLabel' as analyzed_type_label,
  wa.raw_result->>'shortDescription' as analyzed_description,
  wa.analyzed_at::timestamp(0) as analyzed_at,
  
  -- Persistence metadata
  wa.raw_result->'_persistence'->>'success' as persistence_success,
  wa.raw_result->'_persistence'->>'updated' as persistence_updated,
  wa.raw_result->'_persistence'->>'error' as persistence_error
  
FROM businesses b
LEFT JOIN business_profile bp ON b.id = bp.business_id
LEFT JOIN website_analyses wa ON b.id = wa.business_id
WHERE b.id = '450c1b6a-e354-4eef-88d8-86cd2ac8d42b';
