-- Quick diagnostic: Show actual good_examples content
SELECT 
  'Diagnostic: Show actual examples' as check,
  b.name,
  jsonb_array_length(bp.brand_profile_v5->'writing_examples'->'good_examples') as count,
  bp.brand_profile_v5->'writing_examples'->'good_examples'->>0 as example_1,
  bp.brand_profile_v5->'writing_examples'->'good_examples'->>1 as example_2,
  bp.brand_profile_v5->'writing_examples'->'good_examples'->>2 as example_3,
  bp.brand_profile_v5->'writing_examples'->'good_examples'->>3 as example_4,
  bp.brand_profile_v5->'writing_examples'->'good_examples'->>4 as example_5
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust';
