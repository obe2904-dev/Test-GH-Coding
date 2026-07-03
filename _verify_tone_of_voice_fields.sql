-- Verify tone of voice fields are populated and active
-- Check Cafe Faust's voice_guardrails and brand_profile_v5

SELECT 
  b.name,
  bp.voice_guardrails,
  bp.brand_profile_v5,
  bp.tone_of_voice,
  bp.voice_constraints
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust';
