-- Check what columns exist and have data for Cafe Faust
SELECT 
  business_id,
  brand_profile_v5 IS NOT NULL as has_v5,
  brand_essence IS NOT NULL as has_essence,
  business_character IS NOT NULL as has_character,
  target_type_mix IS NOT NULL as has_target_mix,
  revenue_drivers IS NOT NULL as has_revenue_drivers,
  CASE 
    WHEN revenue_drivers IS NOT NULL THEN 
      jsonb_pretty(revenue_drivers)
    ELSE 
      'NULL'
  END as revenue_drivers_data
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
