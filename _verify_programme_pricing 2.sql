-- V5.3 Programme-Specific Price Positioning Verification
-- Tests that each programme has its own price tier and statistics

-- Test 1: Count programmes with price_positioning (from business_programme_profiles table)
SELECT 
  '=== Test 1: Programme Count with Pricing ===' as test,
  COUNT(*) as total_programmes,
  COUNT(price_positioning) as programmes_with_pricing,
  CASE 
    WHEN COUNT(*) = COUNT(price_positioning) THEN '✅ ALL PROGRAMMES HAVE PRICING'
    WHEN COUNT(price_positioning) > 0 THEN '⚠️ PARTIAL PRICING'
    ELSE '❌ NO PRICING DATA'
  END as status
FROM business_programme_profiles
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';

-- Test 2: Extract price positioning per programme (FROM business_programme_profiles TABLE)
SELECT 
  '=== Test 2: Price Tier Per Programme ===' as test,
  programme_type,
  programme_name,
  price_positioning->>'tier' as price_tier,
  price_positioning->>'avg' as avg_price,
  price_positioning->>'min' as min_price,
  price_positioning->>'max' as max_price,
  price_positioning->>'spread' as price_spread,
  price_positioning->>'sample_count' as item_count
FROM business_programme_profiles
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND price_positioning IS NOT NULL
ORDER BY (price_positioning->>'avg')::numeric DESC NULLS LAST;

-- Test 3: Check if marketing_manager_brief includes pricing
SELECT 
  '=== Test 3: Marketing Manager Brief Pricing Content ===' as test,
  business_id,
  CASE 
    WHEN marketing_manager_brief LIKE '%PRIS-POSITIONERING%' THEN '✅ PRICING SECTION FOUND'
    WHEN marketing_manager_brief LIKE '%Premium%kr%' OR marketing_manager_brief LIKE '%Upscale%kr%' THEN '⚠️ PRICING MENTIONED (no header)'
    ELSE '❌ NO PRICING CONTENT'
  END as pricing_check,
  CASE 
    WHEN marketing_manager_brief LIKE '%Budget%kr%' THEN 'Budget tier found'
    WHEN marketing_manager_brief LIKE '%Værdi%kr%' THEN 'Value tier found'
    WHEN marketing_manager_brief LIKE '%Moderat%kr%' THEN 'Moderate tier found'
    WHEN marketing_manager_brief LIKE '%Upscale%kr%' THEN 'Upscale tier found'
    WHEN marketing_manager_brief LIKE '%Premium%kr%' THEN 'Premium tier found'
    ELSE 'No tier labels found'
  END as tier_labels,
  LENGTH(marketing_manager_brief) as brief_length,
  SUBSTRING(marketing_manager_brief FROM 'PRIS-POSITIONERING[^=]*===([^=]*)') as pricing_section_preview
FROM business_brand_profile
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND marketing_manager_brief IS NOT NULL;

-- Test 4: Compare programme pricing to actual menu items (direct aggregation)
WITH menu_prices AS (
  SELECT 
    service_period_name,
    COUNT(DISTINCT item->>'name') as menu_items,
    MIN((item->>'price')::numeric) as menu_min,
    ROUND(AVG((item->>'price')::numeric), 0) as menu_avg,
    MAX((item->>'price')::numeric) as menu_max
  FROM menu_results_v2,
       LATERAL jsonb_array_elements(
         CASE 
           WHEN jsonb_typeof(structured_data) = 'string' THEN (structured_data#>>'{}')::jsonb
           ELSE structured_data
         END->'categories'
       ) as cat,
       LATERAL jsonb_array_elements(cat->'items') as item
  WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
    AND item->>'price' IS NOT NULL
    AND (item->>'price')::numeric > 0
  GROUP BY service_period_name
),
profile_prices AS (
  SELECT 
    programme_type,
    programme_name,
    (price_positioning->>'avg')::numeric as profile_avg,
    (price_positioning->>'min')::numeric as profile_min,
    (price_positioning->>'max')::numeric as profile_max,
    (price_positioning->>'sample_count')::int as profile_count,
    price_positioning->>'tier' as tier
  FROM business_programme_profiles
  WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
    AND price_positioning IS NOT NULL
)
SELECT 
  '=== Test 4: Profile vs Menu Price Comparison ===' as test,
  pp.programme_name,
  pp.tier,
  pp.profile_avg as profile_avg,
  pp.profile_count as profile_items,
  mp.menu_avg as menu_avg,
  mp.menu_items,
  CASE 
    WHEN mp.menu_avg IS NULL THEN '⚠️ NO MENU DATA'
    WHEN ABS(pp.profile_avg - mp.menu_avg) <= 10 THEN '✅ MATCH'
    WHEN ABS(pp.profile_avg - mp.menu_avg) <= 30 THEN '⚠️ CLOSE'
    ELSE '❌ MISMATCH'
  END as avg_match,
  pp.profile_min as profile_min,
  mp.menu_min as menu_min,
  pp.profile_max as profile_max,
  mp.menu_max as menu_max
FROM profile_prices pp
LEFT JOIN menu_prices mp ON UPPER(pp.programme_name) = UPPER(mp.service_period_name)
ORDER BY pp.profile_avg DESC NULLS LAST;
