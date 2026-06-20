-- Debug: Check if brand_profile_v5 exists and when it was last updated
SELECT 
  b.name,
  bp.brand_profile_v5->>'version' as v5_version,
  bp.brand_profile_v5->>'generated_at' as v5_generated_at,
  bp.updated_at,
  bp.brand_profile_v5->'layer_5_voice' IS NOT NULL as has_voice_layer,
  jsonb_pretty(bp.brand_profile_v5->'layer_5_voice') as voice_layer_full
FROM business_brand_profile bp
JOIN businesses b ON b.id = bp.business_id
WHERE bp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
