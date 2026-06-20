-- Check if menu_description_examples field was populated in Voice Profile
-- Run this in Supabase SQL Editor

SELECT 
  b.name as business_name,
  jsonb_pretty(bp.brand_profile_v5->'voice'->'menu_description_examples') as menu_description_examples,
  jsonb_array_length(bp.brand_profile_v5->'voice'->'menu_description_examples') as example_count,
  bp.brand_profile_v5->'voice'->'voice_confidence' as voice_confidence,
  bp.brand_profile_v5->'voice'->'personality_traits' as personality_traits
FROM business_brand_profile bp
JOIN businesses b ON b.id = bp.business_id
WHERE bp.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
