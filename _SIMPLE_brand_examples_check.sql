-- Simple single-query check for Café Faust brand examples
-- Business ID: c2e28ade-cb52-4902-a0ca-86444520af92

SELECT 
  b.name as business_name,
  
  -- Count examples in each source
  jsonb_array_length(COALESCE(bbp.enhanced_social_examples, '[]'::jsonb)) as enhanced_social_count,
  jsonb_array_length(COALESCE(bbp.social_writing_examples, '[]'::jsonb)) as social_writing_count,
  jsonb_array_length(COALESCE(bbp.brand_profile_v5->'voice'->'enhanced_social_examples', '[]'::jsonb)) as voice_enhanced_count,
  jsonb_array_length(COALESCE(bbp.brand_profile_v5->'writing_examples'->'good_examples', '[]'::jsonb)) as good_examples_count,
  jsonb_array_length(COALESCE(bbp.brand_profile_v5->'voice'->'social_writing_examples', '[]'::jsonb)) as voice_social_count,
  
  -- Show which source will be used (priority order)
  CASE 
    WHEN jsonb_array_length(COALESCE(bbp.enhanced_social_examples, '[]'::jsonb)) > 0 
      THEN '1. enhanced_social_examples (top-level)'
    WHEN jsonb_array_length(COALESCE(bbp.brand_profile_v5->'voice'->'enhanced_social_examples', '[]'::jsonb)) > 0 
      THEN '2. voice.enhanced_social_examples'
    WHEN jsonb_array_length(COALESCE(bbp.brand_profile_v5->'writing_examples'->'good_examples', '[]'::jsonb)) > 0 
      THEN '3. writing_examples.good_examples'
    WHEN jsonb_array_length(COALESCE(bbp.social_writing_examples, '[]'::jsonb)) > 0 
      THEN '4. social_writing_examples (top-level)'
    ELSE 'NONE - No examples available'
  END as active_source,
  
  -- Show first 3 examples from the active source
  CASE 
    WHEN jsonb_array_length(COALESCE(bbp.enhanced_social_examples, '[]'::jsonb)) > 0 
      THEN bbp.enhanced_social_examples->0
    WHEN jsonb_array_length(COALESCE(bbp.brand_profile_v5->'voice'->'enhanced_social_examples', '[]'::jsonb)) > 0 
      THEN bbp.brand_profile_v5->'voice'->'enhanced_social_examples'->0
    WHEN jsonb_array_length(COALESCE(bbp.brand_profile_v5->'writing_examples'->'good_examples', '[]'::jsonb)) > 0 
      THEN bbp.brand_profile_v5->'writing_examples'->'good_examples'->0
    WHEN jsonb_array_length(COALESCE(bbp.social_writing_examples, '[]'::jsonb)) > 0 
      THEN bbp.social_writing_examples->0
  END as example_1,
  
  CASE 
    WHEN jsonb_array_length(COALESCE(bbp.enhanced_social_examples, '[]'::jsonb)) > 0 
      THEN bbp.enhanced_social_examples->1
    WHEN jsonb_array_length(COALESCE(bbp.brand_profile_v5->'voice'->'enhanced_social_examples', '[]'::jsonb)) > 0 
      THEN bbp.brand_profile_v5->'voice'->'enhanced_social_examples'->1
    WHEN jsonb_array_length(COALESCE(bbp.brand_profile_v5->'writing_examples'->'good_examples', '[]'::jsonb)) > 0 
      THEN bbp.brand_profile_v5->'writing_examples'->'good_examples'->1
    WHEN jsonb_array_length(COALESCE(bbp.social_writing_examples, '[]'::jsonb)) > 0 
      THEN bbp.social_writing_examples->1
  END as example_2,
  
  CASE 
    WHEN jsonb_array_length(COALESCE(bbp.enhanced_social_examples, '[]'::jsonb)) > 0 
      THEN bbp.enhanced_social_examples->2
    WHEN jsonb_array_length(COALESCE(bbp.brand_profile_v5->'voice'->'enhanced_social_examples', '[]'::jsonb)) > 0 
      THEN bbp.brand_profile_v5->'voice'->'enhanced_social_examples'->2
    WHEN jsonb_array_length(COALESCE(bbp.brand_profile_v5->'writing_examples'->'good_examples', '[]'::jsonb)) > 0 
      THEN bbp.brand_profile_v5->'writing_examples'->'good_examples'->2
    WHEN jsonb_array_length(COALESCE(bbp.social_writing_examples, '[]'::jsonb)) > 0 
      THEN bbp.social_writing_examples->2
  END as example_3

FROM businesses b
LEFT JOIN business_brand_profile bbp ON b.id = bbp.business_id
WHERE b.id = 'c2e28ade-cb52-4902-a0ca-86444520af92';
