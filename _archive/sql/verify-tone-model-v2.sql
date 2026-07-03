-- Tone Model v2 Verification Queries
-- Run these in Supabase SQL Editor after migration

-- ============================================
-- 1. Verify Migration Applied
-- ============================================

-- Check column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'business_brand_profile' 
  AND column_name = 'tone_model';
-- Expected: tone_model | jsonb | YES

-- Check constraint exists
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname = 'tone_model_valid_structure_v2';
-- Expected: One row with comprehensive CHECK constraint

-- Check indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_tone_model%';
-- Expected: 2 indexes (keywords_lang, confidence)


-- ============================================
-- 2. Test Insertion (Validates All Constraints)
-- ============================================

-- This should SUCCEED (valid v2 structure)
INSERT INTO business_brand_profile (business_id, tone_model)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '{
    "primary_keywords": ["test", "verify"],
    "writing_rules": ["Rule 1", "Rule 2", "Rule 3"],
    "good_examples": ["Example 1", "Example 2"],
    "avoid_examples": ["Avoid 1", "Avoid 2"],
    "formality": "informal",
    "emoji_level": "moderate",
    "version": "2.0",
    "language": "da",
    "generated_at": "2026-01-08T23:00:00Z",
    "source": "website",
    "confidence": "high"
  }'
);
-- Expected: SUCCESS (INSERT 0 1)

-- Clean up test
DELETE FROM business_brand_profile
WHERE business_id = '00000000-0000-0000-0000-000000000001';


-- ============================================
-- 3. Test Constraint Violations (Should FAIL)
-- ============================================

-- Missing metadata (should FAIL)
INSERT INTO business_brand_profile (business_id, tone_model)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '{
    "primary_keywords": ["test", "fail"],
    "writing_rules": ["Rule 1", "Rule 2", "Rule 3"],
    "good_examples": ["Example 1", "Example 2"],
    "avoid_examples": ["Avoid 1", "Avoid 2"],
    "formality": "informal",
    "emoji_level": "moderate"
  }'
);
-- Expected: ERROR - violates check constraint "tone_model_valid_structure_v2"

-- Too few keywords (should FAIL)
INSERT INTO business_brand_profile (business_id, tone_model)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '{
    "primary_keywords": ["only-one"],
    "writing_rules": ["Rule 1", "Rule 2", "Rule 3"],
    "good_examples": ["Example 1", "Example 2"],
    "avoid_examples": ["Avoid 1", "Avoid 2"],
    "formality": "informal",
    "emoji_level": "moderate",
    "version": "2.0",
    "language": "da",
    "generated_at": "2026-01-08T23:00:00Z",
    "source": "website",
    "confidence": "high"
  }'
);
-- Expected: ERROR - violates check constraint (array length not between 2 and 6)

-- Invalid enum (should FAIL)
INSERT INTO business_brand_profile (business_id, tone_model)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  '{
    "primary_keywords": ["test", "fail"],
    "writing_rules": ["Rule 1", "Rule 2", "Rule 3"],
    "good_examples": ["Example 1", "Example 2"],
    "avoid_examples": ["Avoid 1", "Avoid 2"],
    "formality": "INVALID",
    "emoji_level": "moderate",
    "version": "2.0",
    "language": "da",
    "generated_at": "2026-01-08T23:00:00Z",
    "source": "website",
    "confidence": "high"
  }'
);
-- Expected: ERROR - violates check constraint (invalid formality enum)


-- ============================================
-- 4. Check Existing Brand Profiles
-- ============================================

-- Count profiles with tone_model
SELECT 
  COUNT(*) as total_profiles,
  COUNT(tone_model) as has_tone_model,
  COUNT(tone_model) FILTER (WHERE tone_model->>'version' = '2.0') as has_v2,
  COUNT(tone_model) FILTER (WHERE tone_model->>'version' IS NULL) as has_v1_or_invalid
FROM business_brand_profile;

-- View sample tone_model data
SELECT 
  business_id,
  tone_model->>'version' as version,
  tone_model->>'language' as language,
  tone_model->>'confidence' as confidence,
  jsonb_array_length(tone_model->'primary_keywords') as keyword_count,
  jsonb_array_length(tone_model->'writing_rules') as rule_count,
  tone_model->'primary_keywords' as keywords
FROM business_brand_profile
WHERE tone_model IS NOT NULL
LIMIT 5;


-- ============================================
-- 5. Force Brand Profile Regeneration
-- ============================================

-- To test tone_model v2 generation, update a business to trigger regeneration
-- Find a business with a brand profile:
SELECT b.id, b.name, bp.business_id
FROM businesses b
LEFT JOIN business_brand_profile bp ON bp.business_id = b.id
WHERE bp.business_id IS NOT NULL
LIMIT 1;

-- Copy the business_id from above, then update it to force regeneration:
-- UPDATE businesses 
-- SET updated_at = NOW()
-- WHERE id = '<paste-business-id-here>';

-- Then call brand-profile-generator function via your app
-- It will regenerate with tone_model v2 (12 fields)


-- ============================================
-- 6. Quality Control Queries
-- ============================================

-- Check confidence distribution
SELECT 
  tone_model->>'confidence' as confidence,
  COUNT(*) as count
FROM business_brand_profile
WHERE tone_model IS NOT NULL
GROUP BY tone_model->>'confidence'
ORDER BY count DESC;

-- Check language distribution
SELECT 
  tone_model->>'language' as language,
  COUNT(*) as count
FROM business_brand_profile
WHERE tone_model IS NOT NULL
GROUP BY tone_model->>'language'
ORDER BY count DESC;

-- Find low-confidence profiles for review
SELECT 
  business_id,
  tone_model->>'confidence' as confidence,
  tone_model->>'notes' as notes,
  tone_model->'primary_keywords' as keywords
FROM business_brand_profile
WHERE tone_model IS NOT NULL
  AND tone_model->>'confidence' = 'low'
LIMIT 10;
