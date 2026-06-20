-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 2 EXTENDED: Verify good_examples Quality After Brand Profile Regeneration
-- ═══════════════════════════════════════════════════════════════════════════
-- Date: June 15, 2026
-- Purpose: Check if good_examples (the actual teaching examples for captions)
--          follow the quality constraints after Fix 2 improvements
-- 
-- SUPABASE SQL EDITOR COMPATIBLE VERSION
-- ═══════════════════════════════════════════════════════════════════════════

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VERIFICATION 1: Check good_examples structure
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SELECT 
  'Verification 1: good_examples Structure' as verification,
  b.name,
  bp.brand_profile_v5->'writing_examples' IS NOT NULL as has_writing_examples,
  jsonb_array_length(bp.brand_profile_v5->'writing_examples'->'good_examples') as good_examples_count,
  CASE 
    WHEN jsonb_array_length(bp.brand_profile_v5->'writing_examples'->'good_examples') >= 3
    THEN '✅ HAS 3+ EXAMPLES'
    ELSE '⚠️ INSUFFICIENT EXAMPLES'
  END as status
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust'
  AND bp.brand_profile_v5 IS NOT NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VERIFICATION 2: Check good_examples content and quality
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SELECT 
  'Verification 2: good_examples Quality' as verification,
  b.name,
  jsonb_pretty(bp.brand_profile_v5->'writing_examples'->'good_examples') as good_examples,
  
  -- Check for imperative openings (bad)
  CASE 
    WHEN (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%"Start %'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%"Kom %'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%"Oplev %'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%"Tag %'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%"Vælg %'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%"Prøv %'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%"Nyd %'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%"Book %'
    THEN '❌ CONTAINS IMPERATIVES - REGENERATE NEEDED'
    ELSE '✅ NO IMPERATIVES DETECTED'
  END as imperative_check,
  
  -- Check for forbidden generic words (bad)
  CASE 
    WHEN (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%lækker%'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%perfekt%'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%autentisk%'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%passion%'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%kærlighed%'
    THEN '⚠️ CONTAINS GENERIC WORDS'
    ELSE '✅ NO GENERIC WORDS'
  END as generic_words_check,
  
  -- Check for location references (good)
  CASE 
    WHEN (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%ved åen%'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%ved Aarhus Å%'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%Aarhus%'
    THEN '✅ LOCATION-ANCHORED'
    ELSE '⚠️ NO LOCATION ANCHORS'
  END as location_check,
  
  -- Check for concrete details (good - look for preparation/process words)
  CASE 
    WHEN (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%steges%'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%koges%'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%bages%'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%tilberedt%'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%serveres%'
      OR (bp.brand_profile_v5->'writing_examples'->'good_examples')::text ILIKE '%klar fra%'
    THEN '✅ CONCRETE PREPARATION DETAILS'
    ELSE '⚠️ MAY LACK CONCRETE DETAILS'
  END as concrete_details_check
  
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust'
  AND bp.brand_profile_v5->'writing_examples'->'good_examples' IS NOT NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VERIFICATION 3: Check individual example lengths
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SELECT 
  'Verification 3: Example Lengths' as verification,
  b.name,
  jsonb_array_length(bp.brand_profile_v5->'writing_examples'->'good_examples') as total_examples,
  
  -- Check length of each example (should be 300-450 chars)
  LENGTH((bp.brand_profile_v5->'writing_examples'->'good_examples'->>0)) as example_1_length,
  LENGTH((bp.brand_profile_v5->'writing_examples'->'good_examples'->>1)) as example_2_length,
  LENGTH((bp.brand_profile_v5->'writing_examples'->'good_examples'->>2)) as example_3_length,
  
  CASE 
    WHEN LENGTH((bp.brand_profile_v5->'writing_examples'->'good_examples'->>0)) BETWEEN 100 AND 500
     AND LENGTH((bp.brand_profile_v5->'writing_examples'->'good_examples'->>1)) BETWEEN 100 AND 500
     AND LENGTH((bp.brand_profile_v5->'writing_examples'->'good_examples'->>2)) BETWEEN 100 AND 500
    THEN '✅ LENGTHS APPROPRIATE'
    ELSE '⚠️ LENGTH OUT OF RANGE'
  END as length_status
  
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust'
  AND bp.brand_profile_v5->'writing_examples'->'good_examples' IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- SUMMARY: Expected Good Examples After Fix 2
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ✅ GOOD EXAMPLE (declarative, location-anchored, concrete):
-- "Pariserbøf med bearnaise og pommes frites. Steges rosa i smør, serveres 
-- ved Aarhus Å. Klar fra kl. 17:30. Book bord 📞"
--
-- ❌ BAD EXAMPLE (imperative, generic, abstract):
-- "Kom og oplev vores lækre Pariserbøf! Perfekt til dig der elsker god mad. 
-- Book dit bord nu! 📞"
--
-- IF all checks are ✅:
--   → good_examples are teaching correct patterns
--   → Caption generation should improve automatically
--   → Proceed to test caption generation
--
-- IF any checks are ❌ or ⚠️:
--   → Regenerate brand profile again
--   → Check if code deployment was successful
-- ═══════════════════════════════════════════════════════════════════════════
