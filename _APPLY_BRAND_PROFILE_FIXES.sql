-- ============================================================
-- BRAND PROFILE CONTRADICTION FIXES — RUN IN SUPABASE DASHBOARD
-- Apply these fixes in: Dashboard → SQL Editor → New Query
-- ============================================================
-- Business: Café Faust
-- ID: 36e24a84-c32d-4123-910a-1bb2e64d34af
-- ============================================================

-- FIX 4: Change formality from "semi-formel" to "casual"
UPDATE business_brand_profile
SET 
  marketing_manager_brief = REPLACE(
    marketing_manager_brief, 
    'semi-formel og legende', 
    'casual og legende'
  ),
  updated_at = NOW()
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af'
  AND marketing_manager_brief LIKE '%semi-formel%';

-- FIX 5: Add writing_examples.good_examples from enhanced_social_examples
-- Step 1: Ensure writing_examples object exists
UPDATE business_brand_profile
SET brand_profile_v5 = jsonb_set(
  COALESCE(brand_profile_v5, '{}'::jsonb),
  '{voice,writing_examples}',
  COALESCE(brand_profile_v5->'voice'->'writing_examples', '{}'::jsonb),
  true
)
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af'
  AND (brand_profile_v5->'voice'->'writing_examples' IS NULL);

-- Step 2: Populate good_examples array
UPDATE business_brand_profile
SET brand_profile_v5 = jsonb_set(
  brand_profile_v5,
  '{voice,writing_examples,good_examples}',
  (
    SELECT jsonb_agg(example->>'text')
    FROM (
      SELECT example
      FROM jsonb_array_elements(enhanced_social_examples) AS example
      LIMIT 5
    ) AS limited_examples
  )
)
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- FIX 1, 2, 3, 6, 7: Update tone_rules and remove duplicates
UPDATE business_brand_profile
SET brand_profile_v5 = jsonb_set(
  brand_profile_v5,
  '{voice,tone_rules}',
  jsonb_build_array(
    'Brug lokale referencer til Aarhus og livet ved åen for at skabe forbindelse til omgivelserne',
    'Fokusér på tilberedningsmetoder og hjemmelavede specialiteter for at fremhæve kvaliteten',
    'Balance klassisk og moderne ved at blande danske og europæiske madkulturelle elementer',
    'Skriv én tanke pr. sætning — stop før du forklarer for at holde kommunikationen klar',
    'Inkluder subtile hints om værdi og tilgængelighed uden at virke prætentiøs',
    'Brug en tone der appellerer til både studerende og urbane professionelle',
    'Undgå generisk salgssprog: "perfekt", "hyggelig", "unik", "autentisk"',
    'Undgå dateret sprog: "svip", "tag en pause fra hverdagen", "varm omfavnelse"'
  )
)
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- Remove duplicate fields (style_rules, structural_rules)
UPDATE business_brand_profile
SET brand_profile_v5 = brand_profile_v5 - 'voice' || jsonb_build_object(
  'voice', 
  (brand_profile_v5->'voice') - 'style_rules' - 'structural_rules'
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
    ) AS rules
  )
)
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- FIX 2: Remove "nyd det gode liv" from generic_marketing
UPDATE business_brand_profile
SET voice_guardrails = jsonb_set(
  voice_guardrails,
  '{avoid_patterns,generic_marketing}',
  (
    SELECT COALESCE(jsonb_agg(phrase), '[]'::jsonb)
    FROM (
      SELECT jsonb_array_elements_text(voice_guardrails->'avoid_patterns'->'generic_marketing') AS phrase
    ) AS phrases
    WHERE phrase NOT ILIKE '%nyd det gode liv%'
  )
)
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

SELECT '=== VERIFICATION RESULTS ===' AS status;

-- Check 1: Formality
SELECT 
  'Formality Level' AS check_name,
  CASE 
    WHEN marketing_manager_brief LIKE '%casual og legende%' THEN '✓ PASS (casual)'
    WHEN marketing_manager_brief LIKE '%semi-formel%' THEN '✗ FAIL (still semi-formel)'
    ELSE 'UNKNOWN'
  END AS result
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- Check 2: Good examples count
SELECT 
  'Good Examples Count' AS check_name,
  jsonb_array_length(brand_profile_v5->'voice'->'writing_examples'->'good_examples') || ' examples' AS result
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- Check 3: Tone rules count (should be 8)
SELECT 
  'Tone Rules Count' AS check_name,
  jsonb_array_length(brand_profile_v5->'voice'->'tone_rules') || ' rules (expected: 8)' AS result
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- Check 4: Duplicate fields removed
SELECT 
  'Duplicate Fields Removed' AS check_name,
  CASE 
    WHEN brand_profile_v5->'voice'->'style_rules' IS NULL 
     AND brand_profile_v5->'voice'->'structural_rules' IS NULL 
    THEN '✓ PASS (removed)'
    ELSE '✗ FAIL (still exist)'
  END AS result
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- Check 5: "Nyd" removed from generic_marketing
SELECT 
  'Nyd Removed' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM jsonb_array_elements_text(voice_guardrails->'avoid_patterns'->'generic_marketing') AS phrase
      WHERE phrase ILIKE '%nyd%'
    ) THEN '✗ FAIL (still present)'
    ELSE '✓ PASS (removed)'
  END AS result
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

SELECT '=== END VERIFICATION ===' AS status;
