-- Check if revenue_drivers exists for Cafe Faust
SELECT 
  business_id,
  revenue_drivers IS NOT NULL as has_revenue_drivers,
  revenue_drivers->'analyzed_at' as analyzed_at,
  revenue_drivers->'confidence_score' as confidence_score,
  revenue_drivers->'primary_revenue_moment'->>'service_type' as primary_service_type,
  jsonb_pretty(revenue_drivers) as revenue_drivers_full
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
