-- Regenerate Café Faust Brand Profile V5 with Tone DNA
-- This will trigger complete V5 generation including:
-- - Layer 0: Business Intelligence + Menu Overview
-- - Layer 1: Programme Detection (Brunch, Frokost, Aften, Menukort)
-- - Layer 2: Commercial Orientation per programme
-- - Layer 3: Identity Profile
-- - Layer 4: Audience Segmentation per programme
-- - Layer 5: Voice Profile
-- - Layer 5.5: Tone DNA (NEW - strategic recommendation)

-- Run this via Supabase Edge Function:
-- POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/brand-profile-generator-v5

-- Request body:
{
  "businessId": "f4679fa9-3120-4a59-9506-d059b010c34a"
}

-- Expected result:
-- ✅ Layer 1: 4 programmes detected (Brunch, Frokost, Aften, Menukort)
-- ✅ Layer 5.5 Tone DNA:
--    - location_driver.primary_dimension = "waterfront" (95 score)
--    - location_driver.score = 95
--    - demographic_signals.primary_demographic = "student" (88 score)
--    - culinary_character.price_positioning = "value" (142 DKK avg)
--    - owner_voice.register_level = "casual"
--    - recommended_tone.tone_positioning = "Casual-warm med waterfront-fokus"
--    - versatility_requirements (for multi-programme hybrid)
--
-- ✅ Enhanced social examples: 12-15 examples covering ALL programmes:
--    - Brunch: 3-4 examples (families, weekend hygge)
--    - Frokost: 3-4 examples (pendlere, quick lunch)
--    - Aften: 3-4 examples (date night, vennegrupper)
--    - Menukort/Bar: 3-4 examples (afterwork, weekend natteliv)
--
-- All examples should:
--    - Reference "ved åen" (waterfront common thread)
--    - Match owner voice ("lækker", "solid", "delikate")
--    - Work for student demographic (casual, accessible)
--    - Include reasoning (why_it_works)

-- Verification queries after regeneration:
-- 1. Check programmes exist:
SELECT jsonb_array_length(brand_profile_v5->'layer_1_programmes') as programme_count
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. Check tone DNA exists:
SELECT 
  brand_profile_v5->'voice'->'tone_dna' IS NOT NULL as has_tone_dna,
  brand_profile_v5->'voice'->'tone_dna'->'recommended_tone'->>'tone_positioning' as tone_positioning,
  brand_profile_v5->'voice'->'tone_dna'->'location_driver'->>'primary_dimension' as primary_location,
  brand_profile_v5->'voice'->'tone_dna'->'location_driver'->>'score' as location_score
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 3. Check enhanced examples:
SELECT 
  jsonb_array_length(brand_profile_v5->'voice'->'enhanced_social_examples') as social_example_count,
  jsonb_array_length(brand_profile_v5->'voice'->'enhanced_avoid_examples') as avoid_example_count
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 4. Check programme coverage in examples:
SELECT 
  example->>'text' as example_text,
  example->>'programme' as programme,
  example->>'content_type' as content_type,
  jsonb_array_length(example->'why_it_works') as reasoning_count
FROM business_brand_profile,
     jsonb_array_elements(brand_profile_v5->'voice'->'enhanced_social_examples') as example
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
LIMIT 5;
