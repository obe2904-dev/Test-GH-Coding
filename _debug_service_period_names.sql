-- Debug: Check what service_period_name values exist in menu_results_v2
SELECT DISTINCT 
  service_period_name,
  service_periods
FROM menu_results_v2
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
ORDER BY service_period_name;
