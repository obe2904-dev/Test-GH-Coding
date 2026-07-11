-- Investigation: Brand Examples for Café Faust (c2e28ade-cb52-4902-a0ca-86444520af92)
-- Purpose: Check which example sources are populated and what they contain

WITH business_data AS (
  SELECT 
    b.id,
    b.name as business_name,
    bbp.social_writing_examples,
    bbp.enhanced_social_examples,
    bbp.enhanced_avoid_examples,
    bbp.brand_profile_v5
  FROM businesses b
  LEFT JOIN business_brand_profile bbp ON b.id = bbp.business_id
  WHERE b.id = 'c2e28ade-cb52-4902-a0ca-86444520af92'
)
SELECT 
  '=== BUSINESS INFO ===' as section,
  business_name,
  id::text as business_id
FROM business_data

UNION ALL

SELECT 
  '=== TOP-LEVEL COLUMNS (priority 1 & 4) ===' as section,
  'enhanced_social_examples count: ' || COALESCE(jsonb_array_length(enhanced_social_examples), 0)::text,
  'social_writing_examples count: ' || COALESCE(jsonb_array_length(social_writing_examples), 0)::text
FROM business_data

UNION ALL

SELECT 
  '=== NESTED V5 SOURCES (priority 2 & 3) ===' as section,
  'voice.enhanced_social_examples: ' || COALESCE(jsonb_array_length(brand_profile_v5->'voice'->'enhanced_social_examples'), 0)::text,
  'writing_examples.good_examples: ' || COALESCE(jsonb_array_length(brand_profile_v5->'writing_examples'->'good_examples'), 0)::text
FROM business_data

UNION ALL

SELECT 
  '=== V5 VOICE SOCIAL WRITING EXAMPLES ===' as section,
  'voice.social_writing_examples: ' || COALESCE(jsonb_array_length(brand_profile_v5->'voice'->'social_writing_examples'), 0)::text,
  ''
FROM business_data;

-- Now show actual content from each source
SELECT '
=== CONTENT: TOP-LEVEL enhanced_social_examples ===' as header;

SELECT 
  idx + 1 as example_number,
  value::text as example_text,
  CASE 
    WHEN value::text ILIKE '%kokken%' OR value::text ILIKE '%hænder%' OR value::text ILIKE '%snitter%' THEN '⚠️ CONTAINS SIMILAR PHRASING'
    ELSE ''
  END as warning
FROM business_brand_profile bbp,
     jsonb_array_elements(bbp.enhanced_social_examples) WITH ORDINALITY arr(value, idx)
WHERE bbp.business_id = 'c2e28ade-cb52-4902-a0ca-86444520af92'
ORDER BY idx;

SELECT '
=== CONTENT: TOP-LEVEL social_writing_examples ===' as header;

SELECT 
  idx + 1 as example_number,
  value::text as example_text
FROM business_brand_profile bbp,
     jsonb_array_elements(bbp.social_writing_examples) WITH ORDINALITY arr(value, idx)
WHERE bbp.business_id = 'c2e28ade-cb52-4902-a0ca-86444520af92'
ORDER BY idx;

SELECT '
=== CONTENT: NESTED voice.enhanced_social_examples ===' as header;

SELECT 
  idx + 1 as example_number,
  value::text as example_text
FROM business_brand_profile bbp,
     jsonb_array_elements(bbp.brand_profile_v5->'voice'->'enhanced_social_examples') WITH ORDINALITY arr(value, idx)
WHERE bbp.business_id = 'c2e28ade-cb52-4902-a0ca-86444520af92'
ORDER BY idx;

SELECT '
=== CONTENT: NESTED writing_examples.good_examples ===' as header;

SELECT 
  idx + 1 as example_number,
  value::text as example_text
FROM business_brand_profile bbp,
     jsonb_array_elements(bbp.brand_profile_v5->'writing_examples'->'good_examples') WITH ORDINALITY arr(value, idx)
WHERE bbp.business_id = 'c2e28ade-cb52-4902-a0ca-86444520af92'
ORDER BY idx;

SELECT '
=== CONTENT: NESTED voice.social_writing_examples ===' as header;

SELECT 
  idx + 1 as example_number,
  value::text as example_text
FROM business_brand_profile bbp,
     jsonb_array_elements(bbp.brand_profile_v5->'voice'->'social_writing_examples') WITH ORDINALITY arr(value, idx)
WHERE bbp.business_id = 'c2e28ade-cb52-4902-a0ca-86444520af92'
ORDER BY idx;

SELECT '
=== SEARCH: Find any examples with "kokken", "hænder", or "snitter" ===' as header;

-- Search in all sources
WITH all_examples AS (
  -- Top-level enhanced_social_examples
  SELECT 
    'enhanced_social_examples (top-level)' as source,
    idx + 1 as position,
    value::text as text
  FROM business_brand_profile bbp,
       jsonb_array_elements(bbp.enhanced_social_examples) WITH ORDINALITY arr(value, idx)
  WHERE bbp.business_id = 'c2e28ade-cb52-4902-a0ca-86444520af92'
  
  UNION ALL
  
  -- Nested voice.enhanced_social_examples
  SELECT 
    'voice.enhanced_social_examples (nested)' as source,
    idx + 1 as position,
    value::text as text
  FROM business_brand_profile bbp,
       jsonb_array_elements(bbp.brand_profile_v5->'voice'->'enhanced_social_examples') WITH ORDINALITY arr(value, idx)
  WHERE bbp.business_id = 'c2e28ade-cb52-4902-a0ca-86444520af92'
  
  UNION ALL
  
  -- writing_examples.good_examples
  SELECT 
    'writing_examples.good_examples' as source,
    idx + 1 as position,
    value::text as text
  FROM business_brand_profile bbp,
       jsonb_array_elements(bbp.brand_profile_v5->'writing_examples'->'good_examples') WITH ORDINALITY arr(value, idx)
  WHERE bbp.business_id = 'c2e28ade-cb52-4902-a0ca-86444520af92'
)
SELECT 
  source,
  position,
  text,
  CASE 
    WHEN text ILIKE '%kokken%' THEN 'Contains: kokken'
    WHEN text ILIKE '%hænder%' THEN 'Contains: hænder'
    WHEN text ILIKE '%snitter%' OR text ILIKE '%skærer%' OR text ILIKE '%hakker%' THEN 'Contains: cooking action verb'
    ELSE 'Contains kitchen/prep language'
  END as match_type
FROM all_examples
WHERE 
  text ILIKE '%kokken%' 
  OR text ILIKE '%hænder%' 
  OR text ILIKE '%snitter%'
  OR text ILIKE '%skærer%'
  OR text ILIKE '%hakker%'
  OR text ILIKE '%forbereder%'
  OR text ILIKE '%grøntsager%'
ORDER BY source, position;
