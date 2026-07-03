-- Check price distribution across service periods/programmes for Café Faust
-- This will help understand if programme-specific pricing makes sense

-- Test 1: Price stats per service period
SELECT 
  '=== Test 1: Price Stats Per Service Period ===' as test,
  UNNEST(service_periods) as service_period,
  COUNT(*) as item_count,
  MIN(price) as min_price,
  ROUND(AVG(price)::numeric, 0) as avg_price,
  MAX(price) as max_price,
  MAX(price) - MIN(price) as price_spread
FROM menu_items_normalized
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND price IS NOT NULL
  AND service_periods IS NOT NULL
  AND array_length(service_periods, 1) > 0
GROUP BY UNNEST(service_periods)
ORDER BY avg_price;

-- Test 2: Sample items per service period with prices
SELECT 
  '=== Test 2: Sample Items Per Service Period ===' as test,
  UNNEST(service_periods) as service_period,
  name,
  price,
  category
FROM menu_items_normalized
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND price IS NOT NULL
  AND service_periods IS NOT NULL
ORDER BY UNNEST(service_periods), price
LIMIT 30;

-- Test 3: Programme types from business_programme_profiles
SELECT 
  '=== Test 3: Detected Programmes ===' as test,
  programme_type,
  programme_name,
  time_windows
FROM business_programme_profiles
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
ORDER BY programme_type;
