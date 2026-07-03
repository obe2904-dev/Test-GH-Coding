-- Check if Cafe Faust has a business_brand_profile row and revenue_drivers data
SELECT 
  COUNT(*) as row_count,
  COUNT(revenue_drivers) as has_revenue_drivers_count
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- If row exists, show the revenue_drivers data
SELECT 
  business_id,
  revenue_drivers IS NOT NULL as has_data,
  CASE 
    WHEN revenue_drivers IS NOT NULL THEN 
      revenue_drivers::text
    ELSE 
      'NULL or missing'
  END as data_check
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
