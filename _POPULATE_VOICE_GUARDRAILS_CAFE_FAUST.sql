-- ═══════════════════════════════════════════════════════════════════════════
-- POPULATE VOICE GUARDRAILS FOR CAFE FAUST
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: Populate voice_guardrails.forbidden_phrases from brand guidelines
-- Date: June 14, 2026
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: Check current state
SELECT 
  b.name,
  bp.voice_guardrails IS NULL AS is_null,
  bp.voice_guardrails = '{}'::jsonb AS is_empty
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust';

-- STEP 2: Populate voice_guardrails with Cafe Faust brand guidelines
UPDATE business_brand_profile bp
SET voice_guardrails = jsonb_build_object(
  -- Forbidden phrases: Words/phrases that violate brand voice
  'forbidden_phrases', jsonb_build_array(
    'perfekt',                    -- Use "velafbalanceret" or delete
    'nyd',                        -- Imperative opening (too generic)
    'lækker',                     -- Generic food adjective
    'hyggelig',                   -- Overused Danish cliché
    'autentisk',                  -- Marketing cliché
    'unik',                       -- Superlative claim
    'svip',                       -- Dated slang
    'oplev',                      -- Experience-verb (brochure language)
    'uforglemmelig',              -- Superlative
    'kulinarisk rejse',           -- Food tourism cliché
    'gastronomisk oplevelse',     -- Pretentious
    'smagseksplosion',            -- Over-the-top metaphor
    'som at få en varm omfavnelse', -- Vague emotional metaphor
    'en symfoni af',              -- Pretentious metaphor
    'en dans på ganen',           -- Food cliché
    'paradis for',                -- Hyperbolic claim
    'oase',                       -- Overused location metaphor
    'skjult perle',               -- Generic discovery claim
    'gemt væk',                   -- Discovery cliché
    'vi har noget for enhver smag' -- Generic inclusivity claim
  ),
  
  -- Never say rules: Word → Replacement mapping
  'never_say', jsonb_build_array(
    'tilbud → kampagne',          -- Commercial preference
    'billigt → god pris',         -- Value framing
    'dyrt → investering i kvalitet' -- Premium framing
  ),
  
  -- Technical terms to avoid (use owner-friendly language)
  'technical_terms', jsonb_build_array(
    'database',
    'API',
    'algoritme',
    'backend',
    'frontend'
  ),
  
  -- Weather clichés (use commercial mechanism instead)
  'weather_cliches', jsonb_build_array(
    'når solen skinner',
    'på en regnvejrsdag',
    'perfekt vejr til',
    'uanset vejret',
    'solskinsvejr',
    'grå himmel'
  ),
  
  -- Avoid patterns (categorized)
  'avoid_patterns', jsonb_build_object(
    -- Brochure language patterns
    'brochure_language', jsonb_build_array(
      'oplev en uforglemmelig',
      'nyd en dejlig',
      'kast dig ud i',
      'lad dig forføre af',
      'dyp ned i'
    ),
    
    -- Superlatives (unprovable claims)
    'superlatives', jsonb_build_array(
      'bedste',
      'fineste',
      'mest unikke',
      'absolut',
      'aldrig før set'
    ),
    
    -- Generic marketing speak
    'generic_marketing', jsonb_build_array(
      'noget for enhver smag',
      'vi glæder os til at se dig',
      'velkommen i',
      'hos os finder du',
      'vi står klar til'
    ),
    
    -- Strip from output (post-generation cleanup)
    'strip_from_output', jsonb_build_object(
      'brochure_language', jsonb_build_array(
        'oplev',
        'nyd',
        'kast dig'
      ),
      'superlatives', jsonb_build_array(
        'perfekt',
        'unik',
        'uforglemmelig'
      ),
      'generic_marketing', jsonb_build_array(
        'vi glæder os',
        'velkommen'
      )
    ),
    
    -- Generation constraints (guide AI, don't strip)
    'generation_constraints', jsonb_build_object(
      'compound_sentences', jsonb_build_array(
        'når',                    -- Avoid time-conditional constructions
        'fordi',                  -- Avoid explanatory compound sentences
        'som',                    -- Avoid metaphorical comparisons
        'ligesom'                 -- Avoid similes
      )
    )
  ),
  
  -- Seasonal notes (context-aware guidance)
  'seasonal_notes', jsonb_build_array(
    'oktober-marts: undgå terrasse-fokus',
    'april-september: fremhæv vandkant og udeservering',
    'december: julespecial tilladt hvis relevant'
  )
)
FROM businesses b
WHERE bp.business_id = b.id
  AND b.name = 'Cafe Faust';

-- STEP 3: Verify update
SELECT 
  b.name,
  jsonb_array_length(bp.voice_guardrails->'forbidden_phrases') AS forbidden_count,
  jsonb_array_length(bp.voice_guardrails->'never_say') AS never_say_count,
  jsonb_array_length(bp.voice_guardrails->'weather_cliches') AS weather_cliches_count,
  
  -- Check if "perfekt" is now blocked
  CASE 
    WHEN bp.voice_guardrails->'forbidden_phrases' @> '["perfekt"]'::jsonb 
    THEN '✅ "perfekt" IS NOW BLOCKED'
    ELSE '❌ FAILED TO ADD "perfekt"'
  END AS perfekt_verification,
  
  -- Show first 10 forbidden words
  (
    SELECT string_agg(value::text, ', ')
    FROM jsonb_array_elements_text(bp.voice_guardrails->'forbidden_phrases')
    LIMIT 10
  ) AS first_10_forbidden
  
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust';

-- STEP 4: Also sync to brand_profile_v5.guardrails (source of truth)
UPDATE business_brand_profile bp
SET brand_profile_v5 = jsonb_set(
  COALESCE(bp.brand_profile_v5, '{}'::jsonb),
  '{guardrails}',
  bp.voice_guardrails
)
FROM businesses b
WHERE bp.business_id = b.id
  AND b.name = 'Cafe Faust';

\echo ''
\echo '✅ Voice guardrails populated for Cafe Faust'
\echo '✅ Synced to brand_profile_v5.guardrails'
\echo ''
\echo 'Next: Regenerate weekly strategy to test the fixes'
