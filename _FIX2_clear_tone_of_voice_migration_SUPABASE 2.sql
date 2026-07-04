-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 2: Clear Poisoned tone_of_voice Values (One-time migration)
-- ═══════════════════════════════════════════════════════════════════════════
-- Date: June 15, 2026
-- Purpose: Clear legacy tone_of_voice column for all V5 businesses
-- Reason: Pre-v5.1.5 businesses have poisoned tone values that conflict with
--         structured V5 tone_dna. The V5 generator writes NULL but existing
--         rows still have old data.
-- 
-- SUPABASE SQL EDITOR COMPATIBLE VERSION (no psql metacommands)
-- ═══════════════════════════════════════════════════════════════════════════

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 1: Count affected rows
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SELECT 
  'STEP 1: Count' as step,
  COUNT(*) as total_businesses_with_v5,
  COUNT(*) FILTER (WHERE tone_of_voice IS NOT NULL) as has_poisoned_tone_of_voice,
  COUNT(*) FILTER (WHERE tone_of_voice IS NULL) as already_clean
FROM business_brand_profile
WHERE brand_profile_v5 IS NOT NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 2: Show affected businesses
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SELECT 
  'STEP 2: Affected Businesses' as step,
  b.name,
  bp.brand_profile_v5_version,
  LEFT(bp.tone_of_voice, 100) as tone_of_voice_preview,
  LENGTH(bp.tone_of_voice) as tone_of_voice_length
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE bp.brand_profile_v5 IS NOT NULL
  AND bp.tone_of_voice IS NOT NULL
ORDER BY b.name;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 3: Execute migration (clear tone_of_voice for V5 businesses)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

UPDATE business_brand_profile
SET 
  tone_of_voice = NULL,
  updated_at = NOW()
WHERE brand_profile_v5 IS NOT NULL
  AND tone_of_voice IS NOT NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 4: Verify migration success
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SELECT 
  'STEP 4: Verification' as step,
  COUNT(*) FILTER (WHERE tone_of_voice IS NOT NULL) as remaining_poisoned_rows,
  CASE 
    WHEN COUNT(*) FILTER (WHERE tone_of_voice IS NOT NULL) = 0 
    THEN '✅ SUCCESS: All V5 businesses now have tone_of_voice = NULL'
    ELSE '❌ ERROR: Some rows still have tone_of_voice values'
  END as migration_status
FROM business_brand_profile
WHERE brand_profile_v5 IS NOT NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 5: Check Cafe Faust specifically
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SELECT 
  'STEP 5: Cafe Faust Check' as step,
  b.name,
  bp.tone_of_voice IS NULL as tone_of_voice_is_null,
  bp.brand_profile_v5 IS NOT NULL as has_v5_profile,
  CASE 
    WHEN bp.tone_of_voice IS NULL AND bp.brand_profile_v5 IS NOT NULL 
    THEN '✅ READY FOR TESTING'
    ELSE '⚠️ NEEDS ATTENTION'
  END as status
FROM businesses b
JOIN business_brand_profile bp ON b.id = bp.business_id
WHERE b.name = 'Cafe Faust';

-- ═══════════════════════════════════════════════════════════════════════════
-- ✅ Fix 2 Step 1 Complete: tone_of_voice column cleared
-- 
-- Next: Regenerate brand profile for Cafe Faust to test Fix 2 Step 2
--       (improved typical_openings generation)
-- ═══════════════════════════════════════════════════════════════════════════
