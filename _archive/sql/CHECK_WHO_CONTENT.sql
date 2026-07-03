-- Check actual WHO content (public vs internal)
SELECT 
  business_id,
  neighborhood,
  who_analysis->>0 as who_public_first,
  who_analysis_internal->>0 as who_internal_first
FROM business_location_intelligence
WHERE business_id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8';
