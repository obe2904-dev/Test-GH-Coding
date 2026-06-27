-- Test 3: Check if marketing_manager_brief includes pricing
SELECT 
  '=== Test 3: Marketing Manager Brief Pricing Content ===' as test,
  business_id,
  CASE 
    WHEN marketing_manager_brief LIKE '%PRIS-POSITIONERING%' THEN '✅ PRICING SECTION FOUND'
    WHEN marketing_manager_brief LIKE '%Premium%kr%' OR marketing_manager_brief LIKE '%Upscale%kr%' OR marketing_manager_brief LIKE '%Værdi%kr%' THEN '⚠️ PRICING MENTIONED (no header)'
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
  updated_at
FROM business_brand_profile
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND marketing_manager_brief IS NOT NULL;
