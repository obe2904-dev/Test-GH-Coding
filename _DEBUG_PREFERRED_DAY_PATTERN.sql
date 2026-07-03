-- Check if preferred_day_pattern exists in revenue_drivers
SELECT 
  business_id,
  revenue_drivers->'preferred_day_pattern' as top_level_pattern,
  revenue_drivers->'normal_week_strategy'->'preferred_days' as normal_week_preferred_days,
  jsonb_pretty(revenue_drivers) as full_json
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
