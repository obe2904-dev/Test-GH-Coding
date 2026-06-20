-- Check menu examples with proper table access
SELECT 
  b.name as business_name,
  bp.brand_profile_v5->'voice'->>'formality_level' as formality,
  bp.brand_profile_v5->'voice'->>'humor_style' as humor,
  bp.brand_profile_v5->'voice'->'personality_traits' as personality,
  bp.brand_profile_v5->'voice'->'tone_rules' as tone_rules,
  bp.brand_profile_v5->'voice'->'menu_description_examples' as examples
FROM business_brand_profile bp
JOIN businesses b ON b.id = bp.business_id
WHERE b.name ILIKE '%faust%'
LIMIT 1;
