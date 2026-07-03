-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 2 VERIFICATION: Check Results After Implementation
-- ═══════════════════════════════════════════════════════════════════════════
-- Date: June 15, 2026
-- Purpose: Verify Fix 2 was successful
-- ═══════════════════════════════════════════════════════════════════════════

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'VERIFICATION 1: tone_of_voice column should be NULL for all V5 businesses'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  COUNT(*) FILTER (WHERE brand_profile_v5 IS NOT NULL) as v5_businesses,
  COUNT(*) FILTER (WHERE brand_profile_v5 IS NOT NULL AND tone_of_voice IS NULL) as correctly_nulled,
  COUNT(*) FILTER (WHERE brand_profile_v5 IS NOT NULL AND tone_of_voice IS NOT NULL) as still_poisoned,
  CASE 
    WHEN COUNT(*) FILTER (WHERE brand_profile_v5 IS NOT NULL AND tone_of_voice IS NOT NULL) = 0
    THEN '✅ SUCCESS'
    ELSE '❌ FAILED - Some businesses still have poisoned tone_of_voice'
  END as status
FROM business_brand_profile;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'VERIFICATION 2: Cafe Faust specific check'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  b.name,
  bp.tone_of_voice IS NULL as tone_of_voice_cleared,
  bp.brand_profile_v5 IS NOT NULL as has_v5_profile,
  bp.brand_profile_v5->'writing_examples' IS NOT NULL as has_writing_examples,
  jsonb_array_length(bp.brand_profile_v5->'writing_examples'->'typical_openings') as typical_openings_count,
  CASE 
    WHEN bp.tone_of_voice IS NULL AND bp.brand_profile_v5 IS NOT NULL 
    THEN '✅ READY FOR TESTING'
    ELSE '⚠️ NEEDS REGENERATION'
  END as status
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'VERIFICATION 3: Check typical_openings quality (after regeneration)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  b.name,
  jsonb_pretty(bp.brand_profile_v5->'writing_examples'->'typical_openings') as typical_openings,
  
  -- Check for bad patterns (imperatives)
  CASE 
    WHEN bp.brand_profile_v5->'writing_examples'->'typical_openings'::text ILIKE '%Kom %' 
      OR bp.brand_profile_v5->'writing_examples'->'typical_openings'::text ILIKE '%Book %'
      OR bp.brand_profile_v5->'writing_examples'->'typical_openings'::text ILIKE '%Vi er klar%'
      OR bp.brand_profile_v5->'writing_examples'->'typical_openings'::text ILIKE '%Velkommen%'
      OR bp.brand_profile_v5->'writing_examples'->'typical_openings'::text ILIKE '%Prøv %'
      OR bp.brand_profile_v5->'writing_examples'->'typical_openings'::text ILIKE '%Nyd %'
    THEN '❌ CONTAINS GENERIC IMPERATIVES'
    ELSE '✅ NO IMPERATIVES DETECTED'
  END as imperative_check,
  
  -- Check for location-anchored openings (good)
  CASE 
    WHEN bp.brand_profile_v5->'writing_examples'->'typical_openings'::text ILIKE '%ved åen%'
      OR bp.brand_profile_v5->'writing_examples'->'typical_openings'::text ILIKE '%ved Aarhus Å%'
      OR bp.brand_profile_v5->'writing_examples'->'typical_openings'::text ILIKE '%klar fra%'
      OR bp.brand_profile_v5->'writing_examples'->'typical_openings'::text ILIKE '%Solskin%'
    THEN '✅ LOCATION-ANCHORED OPENINGS FOUND'
    ELSE '⚠️ NO LOCATION ANCHORS (may need regeneration)'
  END as location_anchor_check
  
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust'
  AND bp.brand_profile_v5->'writing_examples'->'typical_openings' IS NOT NULL;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'SUMMARY: Next Steps'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

\echo ''
\echo 'If tone_of_voice is cleared:'
\echo '  ✅ Fix 2 Step 1 (SQL migration) complete'
\echo ''
\echo 'If typical_openings still contain imperatives:'
\echo '  → Regenerate brand profile for Cafe Faust to test Fix 2 Step 2'
\echo '  → Check if new openings are location-anchored (e.g., "Solskin ved åen")'
\echo ''
\echo 'Expected good openings after regeneration:'
\echo '  - "Solskin ved Aarhus Å."'
\echo '  - "Bøf & bearnaise klar fra 17:30."'
\echo '  - "Weekenden starter ved åen."'
\echo '  - "Morgenmad. Udeservering."'
\echo ''
