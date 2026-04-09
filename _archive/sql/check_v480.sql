SELECT 
  b.name,
  bp.quality_status,
  bp.brand_essence,
  CASE 
    WHEN bp.brand_essence LIKE '%ved ved%' THEN '❌ Double preposition bug'
    WHEN bp.brand_essence LIKE '%ved åen%' THEN '✅ Fixed - single preposition'
    ELSE '?' 
  END as preposition_check,
  (bp.image_preferences_jsonb->>'signature_shot') as signature_shot,
  bp.updated_at::text as last_updated
FROM business_brand_profile bp
JOIN businesses b ON b.id = bp.business_id
WHERE b.id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8'
ORDER BY bp.updated_at DESC
LIMIT 1;
