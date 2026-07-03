-- Check full voice structure including menu examples
SELECT 
  b.name as business_name,
  jsonb_pretty(bp.brand_profile_v5->'voice') as voice_full
FROM business_brand_profile bp
JOIN businesses b ON b.id = bp.business_id
WHERE b.name ILIKE '%faust%'
LIMIT 1;
