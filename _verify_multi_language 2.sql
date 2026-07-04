-- V5.3 Multi-Language Verification
-- Tests that customer situations and marketing brief are in correct language

-- Test 1: Marketing Manager Brief Language
SELECT 
  '=== Test 1: Marketing Manager Brief Language ===' as test,
  business_id,
  LENGTH(marketing_manager_brief) as brief_length,
  CASE 
    WHEN marketing_manager_brief LIKE '%lunch break%' 
      OR marketing_manager_brief LIKE '%working lunch%'
      OR marketing_manager_brief LIKE '%quick bite%' THEN '❌ ENGLISH DETECTED'
    WHEN marketing_manager_brief LIKE '%frokostpause%' 
      OR marketing_manager_brief LIKE '%arbejdsfrokost%'
      OR marketing_manager_brief LIKE '%hurtig frokost%' THEN '✅ DANISH DETECTED'
    ELSE '❓ UNKNOWN LANGUAGE'
  END as language_check,
  SUBSTRING(marketing_manager_brief, 1, 300) as brief_preview
FROM business_brand_profile
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND marketing_manager_brief IS NOT NULL;

-- Test 2: USP Extraction
SELECT 
  '=== Test 2: USP Extraction ===' as test,
  business_id,
  brand_profile_v5->'layer_0_intelligence'->'usps'->'primary_usp'->>'text' as primary_usp,
  brand_profile_v5->'layer_0_intelligence'->'usps'->'primary_usp'->>'score' as primary_usp_score,
  jsonb_array_length(brand_profile_v5->'layer_0_intelligence'->'usps'->'secondary_usps') as secondary_usp_count
FROM business_brand_profile
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND brand_profile_v5->'layer_0_intelligence'->'usps' IS NOT NULL;

-- Test 3: Customer Situations Language (detailed per programme)
SELECT 
  '=== Test 3: Customer Situations Language ===' as test,
  programme_type,
  segment->>'segment_name' as segment_name,
  segment->'situations' as situations,
  CASE 
    WHEN segment->>'situations' LIKE '%lunch break%' 
      OR segment->>'situations' LIKE '%working lunch%'
      OR segment->>'situations' LIKE '%quick bite%' 
      OR segment->>'situations' LIKE '%after-work drinks%' THEN '❌ ENGLISH'
    WHEN segment->>'situations' LIKE '%frokostpause%' 
      OR segment->>'situations' LIKE '%arbejdsfrokost%'
      OR segment->>'situations' LIKE '%hurtig frokost%'
      OR segment->>'situations' LIKE '%efter arbejde%' THEN '✅ DANISH'
    ELSE '❓ UNKNOWN'
  END as language_check
FROM business_programme_profiles,
     jsonb_array_elements(audience_segments) as segment
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND audience_segments IS NOT NULL
ORDER BY programme_type, segment->>'segment_name';
