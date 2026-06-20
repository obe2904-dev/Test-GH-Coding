-- Check Cafe Faust's actual voice rules and persona
SELECT 
  'Voice Rules Check' as check,
  b.name,
  jsonb_pretty(bp.brand_profile_v5->'voice'->'tone_rules') as tone_rules,
  jsonb_pretty(bp.brand_profile_v5->'voice'->'personality_traits') as personality_traits,
  bp.brand_profile_v5->'voice'->>'formality_level' as formality_level,
  bp.brand_profile_v5->'voice'->>'sentence_structure' as sentence_structure,
  bp.brand_profile_v5->>'business_identity_persona' as business_identity_persona
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust';
