-- FIX: Brand Profile Contradictions for Café Faust
-- This SQL updates the brand_profile_v5 and voice_guardrails JSONB columns
-- to resolve the contradictions identified in the brand profile review.

-- Business ID: 36e24a84-c32d-4123-910a-1bb2e64d34af

-- ============================================================
-- HIGH PRIORITY FIXES
-- ============================================================

-- FIX 1: Remove imperative ban from tone_rules
-- FIX 2: Remove "nyd" from tone_rules generisk salgssprog
-- FIX 3: Remove "lækker" from tone_rules generisk salgssprog
-- FIX 4: Set formality to informal (already correct, verified)
-- FIX 6: Remove duplicate style_rules and structural_rules

UPDATE business_brand_profile
SET brand_profile_v5 = jsonb_set(
  jsonb_set(
    jsonb_set(
      brand_profile_v5,
      '{voice,tone_rules}',
      (
        SELECT jsonb_agg(rule)
        FROM (
          SELECT unnest(
            ARRAY[
              'Brug lokale referencer til Aarhus og livet ved åen for at skabe forbindelse til omgivelserne',
              'Fokusér på tilberedningsmetoder og hjemmelavede specialiteter for at fremhæve kvaliteten',
              'Balance klassisk og moderne ved at blande danske og europæiske madkulturelle elementer',
              'Skriv én tanke pr. sætning — stop før du forklarer for at holde kommunikationen klar',
              'Inkluder subtile hints om værdi og tilgængelighed uden at virke prætentiøs',
              'Brug en tone der appellerer til både studerende og urbane professionelle',
              'Undgå generisk salgssprog: "perfekt", "hyggelig", "unik", "autentisk"',
              'Undgå dateret sprog: "svip", "tag en pause fra hverdagen", "varm omfavnelse"'
            ]
          ) AS rule
        ) AS cleaned_rules
      )
    ),
    '{voice,style_rules}',
    'null'::jsonb
  ),
  '{voice,structural_rules}',
  'null'::jsonb
)
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- FIX 5: Add writing_examples.good_examples from enhanced_social_examples
UPDATE business_brand_profile
SET brand_profile_v5 = jsonb_set(
  brand_profile_v5,
  '{voice,writing_examples,good_examples}',
  (
    SELECT jsonb_agg(example->'text')
    FROM (
      SELECT jsonb_array_elements(enhanced_social_examples) AS example
      FROM business_brand_profile
      WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af'
      LIMIT 5
    ) AS examples
  )
)
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- ============================================================
-- VOICE GUARDRAILS FIXES
-- ============================================================

-- FIX 2 & 7: Remove "nyd det gode liv" from generic_marketing
UPDATE business_brand_profile
SET voice_guardrails = jsonb_set(
  voice_guardrails,
  '{avoid_patterns,generic_marketing}',
  (
    SELECT jsonb_agg(phrase)
    FROM (
      SELECT jsonb_array_elements_text(voice_guardrails->'avoid_patterns'->'generic_marketing') AS phrase
      FROM business_brand_profile
      WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af'
    ) AS phrases
    WHERE phrase NOT ILIKE '%nyd det gode liv%'
  )
)
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- FIX 3: Update "lækkert" rule in never_say to be context-aware
UPDATE business_brand_profile
SET voice_guardrails = jsonb_set(
  voice_guardrails,
  '{never_say}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN rule LIKE 'lækkert%' 
        THEN 'lækkert (som abstrakt ros) → (undgå); lækker [ret] (konkret beskrivelse) → OK'
        ELSE rule
      END
    )
    FROM (
      SELECT jsonb_array_elements_text(voice_guardrails->'never_say') AS rule
      FROM business_brand_profile
      WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af'
    ) AS rules
  )
)
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- FIX 7: Add consolidated_banned_vocabulary (for future use)
UPDATE business_brand_profile
SET voice_guardrails = voice_guardrails || jsonb_build_object(
  'consolidated_banned_vocabulary',
  (
    SELECT jsonb_agg(DISTINCT banned_word ORDER BY banned_word)
    FROM (
      -- From never_say (extract word before →)
      SELECT TRIM(SPLIT_PART(jsonb_array_elements_text(voice_guardrails->'never_say'), '→', 1)) AS banned_word
      FROM business_brand_profile
      WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af'
      
      UNION ALL
      
      -- From generic_marketing
      SELECT jsonb_array_elements_text(voice_guardrails->'avoid_patterns'->'generic_marketing') AS banned_word
      FROM business_brand_profile
      WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af'
      
      UNION ALL
      
      -- From superlatives
      SELECT jsonb_array_elements_text(voice_guardrails->'avoid_patterns'->'superlatives') AS banned_word
      FROM business_brand_profile
      WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af'
    ) AS all_banned
    WHERE banned_word IS NOT NULL 
      AND banned_word != ''
      AND banned_word NOT LIKE '%(OK)%'
  )
)
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- ============================================================
-- MARKETING MANAGER BRIEF FIX
-- ============================================================

-- FIX 4: Update marketing_manager_brief to use "casual" instead of "semi-formel"
UPDATE business_brand_profile
SET marketing_manager_brief = REPLACE(
  marketing_manager_brief,
  'semi-formel og legende',
  'casual og legende'
)
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af'
  AND marketing_manager_brief LIKE '%semi-formel%';

-- Update timestamp
UPDATE business_brand_profile
SET updated_at = NOW()
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Verify tone_rules count (should be 8, down from 9)
SELECT 
  'tone_rules count' AS check_name,
  jsonb_array_length(brand_profile_v5->'voice'->'tone_rules') AS value,
  'Should be 8 (removed imperative ban)' AS expected
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- Verify writing_examples.good_examples exists
SELECT 
  'good_examples count' AS check_name,
  jsonb_array_length(brand_profile_v5->'voice'->'writing_examples'->'good_examples') AS value,
  'Should be 5' AS expected
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- Verify style_rules and structural_rules removed
SELECT 
  'duplicate_fields_removed' AS check_name,
  CASE 
    WHEN brand_profile_v5->'voice'->'style_rules' IS NULL 
     AND brand_profile_v5->'voice'->'structural_rules' IS NULL 
    THEN 'PASS ✓'
    ELSE 'FAIL ✗'
  END AS value,
  'style_rules and structural_rules should be null' AS expected
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- Verify consolidated_banned_vocabulary created
SELECT 
  'consolidated_banned_count' AS check_name,
  jsonb_array_length(voice_guardrails->'consolidated_banned_vocabulary') AS value,
  'Should be > 0' AS expected
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- Verify formality_level
SELECT 
  'formality_level' AS check_name,
  brand_profile_v5->'voice'->>'formality_level' AS value,
  'Should be "informal"' AS expected
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- Verify marketing brief updated
SELECT 
  'marketing_brief_formality' AS check_name,
  CASE 
    WHEN marketing_manager_brief LIKE '%casual og legende%' THEN 'PASS ✓'
    WHEN marketing_manager_brief LIKE '%semi-formel%' THEN 'FAIL ✗ (still has semi-formel)'
    ELSE 'UNKNOWN'
  END AS value,
  'Should contain "casual og legende"' AS expected
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';
