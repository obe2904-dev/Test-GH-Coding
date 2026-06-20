-- Check if source data exists in brand_profile_v5.guardrails
SELECT 
  b.name,
  bp.brand_profile_v5 IS NOT NULL AS has_v5_profile,
  bp.brand_profile_v5->'guardrails' IS NOT NULL AS has_guardrails_section,
  jsonb_pretty(bp.brand_profile_v5->'guardrails'->'forbidden_phrases') AS source_forbidden_phrases,
  jsonb_pretty(bp.brand_profile_v5->'guardrails'->'never_say') AS source_never_say
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust';
