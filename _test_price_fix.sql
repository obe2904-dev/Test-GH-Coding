-- Verify price_positioning has correct values (not astronomical)
SELECT 
  programme_type,
  programme_name,
  price_positioning->>'tier' as price_tier,
  (price_positioning->>'avg')::numeric as avg_price,  -- Cast to numeric to see actual value
  (price_positioning->>'min')::numeric as min_price,
  (price_positioning->>'max')::numeric as max_price,
  (price_positioning->>'spread')::numeric as price_spread,
  (price_positioning->>'sample_count')::int as item_count
FROM business_programme_profiles
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND price_positioning IS NOT NULL
ORDER BY avg_price DESC NULLS LAST;

-- Also check marketing brief has pricing section
SELECT 
  CASE 
    WHEN marketing_manager_brief LIKE '%=== PRIS-POSITIONERING%' THEN '✅ PRICING SECTION FOUND'
    ELSE '❌ NO PRICING CONTENT'
  END as pricing_check,
  SUBSTRING(marketing_manager_brief FROM '=== PRIS-POSITIONERING[^=]*===') as pricing_section_preview
FROM business_brand_profile
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';
