-- Check Café Faust signature themes and whether fusion detection would trigger

-- 1. Check signature themes
SELECT 
  b.name,
  jsonb_pretty(bp.brand_profile_v5->'programmes'->0->'signature_themes') as signature_themes,
  bp.brand_profile_v5->'programmes'->0->>'gastronomic_profile' as gastronomic_profile,
  -- Check if fusion pattern would match
  CASE 
    WHEN (bp.brand_profile_v5->'programmes'->0->'signature_themes')::text ~* 'fransk|french|italiensk|italian|belgisk|belge|spansk|spanish|international|fusion|mediterran' 
    THEN 'YES - FUSION DETECTED'
    ELSE 'NO - No fusion positioning'
  END as fusion_detection
FROM business_brand_profile bp
JOIN businesses b ON b.id = bp.business_id
WHERE bp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
