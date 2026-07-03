-- Debug: Check raw price_positioning JSONB data
SELECT 
  programme_type,
  programme_name,
  price_positioning,
  jsonb_pretty(price_positioning) as price_positioning_pretty
FROM business_programme_profiles
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND price_positioning IS NOT NULL
ORDER BY programme_type;
