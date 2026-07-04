-- Check what's actually in voice_guardrails and brand_profile_v5 for Cafe Faust
SELECT 
  b.name,
  jsonb_pretty(bp.voice_guardrails) as voice_guardrails_content,
  jsonb_pretty(bp.brand_profile_v5->'voice') as brand_profile_v5_voice
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust';
