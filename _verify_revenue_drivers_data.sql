-- Direct check: Does Cafe Faust have revenue_drivers data?
SELECT 
  business_id,
  revenue_drivers IS NOT NULL as has_revenue_drivers,
  jsonb_typeof(revenue_drivers) as revenue_drivers_type,
  CASE 
    WHEN revenue_drivers IS NOT NULL THEN 
      jsonb_pretty(revenue_drivers)
    ELSE 
      'NULL - no data in column'
  END as revenue_drivers_content
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Also check when it was last updated
SELECT 
  business_id,
  updated_at,
  created_at
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
