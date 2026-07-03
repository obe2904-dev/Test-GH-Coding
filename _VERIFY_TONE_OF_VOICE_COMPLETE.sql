-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY CAFE FAUST TONE OF VOICE DATA
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: Check which tone of voice fields are populated and active
-- Date: June 14, 2026
-- ═══════════════════════════════════════════════════════════════════════════

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '1. LEGACY TONE FIELDS (Pre-V5)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  b.name AS business_name,
  
  -- Legacy tone fields (lines 60-62 from schema)
  CASE 
    WHEN bp.tone_of_voice IS NOT NULL THEN 
      LEFT(bp.tone_of_voice, 100) || '... (' || LENGTH(bp.tone_of_voice) || ' chars)'
    ELSE 'NULL'
  END AS tone_of_voice_preview,
  
  bp.tone_keywords AS tone_keywords,
  
  CASE 
    WHEN bp.tone_model IS NOT NULL THEN 
      jsonb_pretty(bp.tone_model)
    ELSE 'NULL'
  END AS tone_model_json,
  
  -- Voice constraints and examples (lines 66, 73)
  CASE 
    WHEN bp.voice_constraints IS NOT NULL THEN 
      LEFT(bp.voice_constraints, 100) || '...'
    ELSE 'NULL'
  END AS voice_constraints_preview,
  
  CASE 
    WHEN bp.voice_examples IS NOT NULL THEN 
      jsonb_pretty(bp.voice_examples)
    ELSE 'NULL'
  END AS voice_examples_json,
  
  -- Personality fields (lines 83-86)
  bp.visual_character,
  bp.venue_scene,
  bp.venue_energy,
  bp.recognizable_interior_identity
  
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '2. V5 STRUCTURED FIELDS (brand_profile_v5)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  b.name AS business_name,
  bp.brand_profile_v5_version,
  bp.brand_profile_v5_generated_at,
  
  -- Check if main sections exist
  CASE WHEN bp.brand_profile_v5->'voice' IS NOT NULL THEN '✅' ELSE '❌' END AS has_voice_section,
  CASE WHEN bp.brand_profile_v5->'writing_examples' IS NOT NULL THEN '✅' ELSE '❌' END AS has_writing_examples,
  CASE WHEN bp.brand_profile_v5->'guardrails' IS NOT NULL THEN '✅' ELSE '❌' END AS has_guardrails_section,
  CASE WHEN bp.brand_profile_v5->'identity' IS NOT NULL THEN '✅' ELSE '❌' END AS has_identity_section,
  
  -- Voice layer details
  jsonb_array_length(bp.brand_profile_v5->'voice'->'tone_rules') AS tone_rules_count,
  bp.brand_profile_v5->'voice'->>'formality_level' AS formality_level,
  bp.brand_profile_v5->'voice'->>'humor_style' AS humor_style,
  
  -- Writing examples details
  jsonb_array_length(bp.brand_profile_v5->'writing_examples'->'typical_openings') AS typical_openings_count,
  jsonb_array_length(bp.brand_profile_v5->'writing_examples'->'signature_phrases') AS signature_phrases_count
  
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '3. VOICE GUARDRAILS (Flattened from brand_profile_v5.guardrails)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  b.name AS business_name,
  
  -- Check if voice_guardrails exists and has content
  CASE 
    WHEN bp.voice_guardrails IS NULL THEN 'NULL ❌'
    WHEN bp.voice_guardrails = '{}'::jsonb THEN 'EMPTY {} ❌'
    ELSE '✅ POPULATED'
  END AS guardrails_status,
  
  -- Count arrays
  jsonb_array_length(COALESCE(bp.voice_guardrails->'forbidden_phrases', '[]'::jsonb)) AS forbidden_phrases_count,
  jsonb_array_length(COALESCE(bp.voice_guardrails->'never_say', '[]'::jsonb)) AS never_say_count,
  jsonb_array_length(COALESCE(bp.voice_guardrails->'technical_terms', '[]'::jsonb)) AS technical_terms_count,
  jsonb_array_length(COALESCE(bp.voice_guardrails->'weather_cliches', '[]'::jsonb)) AS weather_cliches_count
  
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '4. FORBIDDEN PHRASES DETAIL (What AI should NEVER use)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  b.name AS business_name,
  jsonb_pretty(bp.voice_guardrails->'forbidden_phrases') AS forbidden_phrases_array
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '5. TONE DNA (V5.5+ Strategic Synthesis)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  b.name AS business_name,
  
  -- Check if tone_dna exists
  CASE 
    WHEN bp.brand_profile_v5->'voice'->'tone_dna' IS NOT NULL THEN '✅ EXISTS'
    ELSE '❌ NOT FOUND'
  END AS has_tone_dna,
  
  -- Extract tone_positioning (authoritative brandTone)
  bp.brand_profile_v5->'voice'->'tone_dna'->'recommended_tone'->>'tone_positioning' AS tone_positioning,
  
  -- Extract tone rules
  jsonb_array_length(
    COALESCE(bp.brand_profile_v5->'voice'->'tone_dna'->'tone_do_list', '[]'::jsonb)
  ) AS tone_do_list_count,
  
  jsonb_pretty(
    bp.brand_profile_v5->'voice'->'tone_dna'->'tone_do_list'
  ) AS tone_do_list_rules
  
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '6. FULL GUARDRAILS STRUCTURE (Complete JSON)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  b.name AS business_name,
  jsonb_pretty(bp.voice_guardrails) AS complete_guardrails_json
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '7. COMPARISON: Source vs Flattened'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  b.name AS business_name,
  
  -- Source (brand_profile_v5.guardrails)
  jsonb_array_length(
    COALESCE(bp.brand_profile_v5->'guardrails'->'forbidden_phrases', '[]'::jsonb)
  ) AS source_forbidden_count,
  
  -- Flattened (voice_guardrails)
  jsonb_array_length(
    COALESCE(bp.voice_guardrails->'forbidden_phrases', '[]'::jsonb)
  ) AS flattened_forbidden_count,
  
  -- Are they in sync?
  CASE 
    WHEN bp.brand_profile_v5->'guardrails'->'forbidden_phrases' = bp.voice_guardrails->'forbidden_phrases'
    THEN '✅ IN SYNC'
    ELSE '⚠️ OUT OF SYNC'
  END AS sync_status
  
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust';
