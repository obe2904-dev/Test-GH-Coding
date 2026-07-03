-- Database Cleanup v17: Consolidate Brand Voice Duplicates
-- Date: 17. februar 2026
-- Purpose: Clean up semantic duplicates before Phase 1 implementation
-- SAFE: Backward compatible, no data loss

-- =============================================================================
-- STEP 1: PRE-CLEANUP VERIFICATION
-- =============================================================================

-- Check current state of Café Faust (test business)
SELECT 
  business_id,
  -- Enriched fields (should have data)
  COALESCE(array_length(never_say, 1), 0) as never_say_count,
  never_say[1:5] as never_say_sample,
  COALESCE(array_length(signature_phrases, 1), 0) as signature_phrases_count,
  signature_phrases,
  COALESCE(array_length(typical_openings, 1), 0) as typical_openings_count,
  humor_level,
  formality,
  emoji_style,
  
  -- Legacy fields (may have duplicate data)
  do_not_say IS NOT NULL as has_do_not_say,
  do_not_say,
  things_to_avoid IS NOT NULL as has_things_to_avoid,
  things_to_avoid
FROM business_brand_profile
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- =============================================================================
-- STEP 2: CONSOLIDATE never_say FROM LEGACY FIELDS
-- =============================================================================

-- Strategy: Merge all unique values from do_not_say and things_to_avoid into never_say
-- Keep backward compatibility (don't drop legacy columns yet)

DO $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- Update never_say with merged data from legacy fields
  WITH legacy_data AS (
    SELECT 
      business_id,
      never_say,
      CASE 
        -- Extract words from do_not_say JSONB {words: [...]}
        WHEN do_not_say IS NOT NULL AND do_not_say ? 'words' THEN 
          ARRAY(SELECT jsonb_array_elements_text(do_not_say->'words'))
        ELSE 
          ARRAY[]::text[]
      END as do_not_say_words,
      CASE 
        -- Extract words from things_to_avoid (structure TBD)
        WHEN things_to_avoid IS NOT NULL AND things_to_avoid ? 'words' THEN 
          ARRAY(SELECT jsonb_array_elements_text(things_to_avoid->'words'))
        WHEN things_to_avoid IS NOT NULL AND jsonb_typeof(things_to_avoid) = 'array' THEN
          ARRAY(SELECT jsonb_array_elements_text(things_to_avoid))
        ELSE 
          ARRAY[]::text[]
      END as things_avoid_words
    FROM business_brand_profile
    WHERE do_not_say IS NOT NULL OR things_to_avoid IS NOT NULL
  ),
  merged_data AS (
    SELECT 
      business_id,
      -- Merge and deduplicate: never_say + do_not_say + things_to_avoid
      ARRAY(
        SELECT DISTINCT unnest(
          COALESCE(never_say, ARRAY[]::text[]) || 
          do_not_say_words || 
          things_avoid_words
        )
      ) as merged_never_say
    FROM legacy_data
    WHERE array_length(do_not_say_words, 1) > 0 
       OR array_length(things_avoid_words, 1) > 0
  )
  UPDATE business_brand_profile bp
  SET never_say = md.merged_never_say
  FROM merged_data md
  WHERE bp.business_id = md.business_id
    AND (bp.never_say IS NULL OR array_length(bp.never_say, 1) < array_length(md.merged_never_say, 1));
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % rows with consolidated never_say data', updated_count;
END $$;

-- =============================================================================
-- STEP 3: ADD SCHEMA COMMENTS (DEPRECATION MARKERS)
-- =============================================================================

-- Mark primary fields
COMMENT ON COLUMN business_brand_profile.never_say IS 
'✅ PRIMARY: Banned words/phrases for content generation. Array of 50-100 terms including both generic terms and business-specific avoidances. Used by caption generator and strategy generator. Consolidated from legacy do_not_say and things_to_avoid fields.';

COMMENT ON COLUMN business_brand_profile.signature_phrases IS 
'✅ PRIMARY: Distinctive phrases that identify this specific business (2-8 phrases). Examples: "ved åen i Aarhus", "siden 2008", "håndlavet hver dag". Used naturally in captions to reinforce brand voice.';

COMMENT ON COLUMN business_brand_profile.typical_openings IS 
'✅ PRIMARY: Common opening phrases for social posts (5-10 items). Examples: "Der er en grund til...", "Vi elsker...". AI uses these as inspiration, not templates.';

COMMENT ON COLUMN business_brand_profile.typical_closings IS 
'✅ PRIMARY: Common closing phrases for social posts (3-7 items). Examples: "Vi ses ☕", "Velkommen indenfor". Optional - not all posts need closings.';

COMMENT ON COLUMN business_brand_profile.humor_level IS 
'✅ PRIMARY: Inferred humor sensibility - none, subtle, or playful. Guides AI tone calibration.';

COMMENT ON COLUMN business_brand_profile.formality IS 
'✅ PRIMARY: Communication formality - professional, casual, or friendly. Guides AI language choice (du/De, vocabulary level).';

COMMENT ON COLUMN business_brand_profile.emoji_style IS 
'✅ PRIMARY: Emoji usage preference - minimal, moderate, or expressive. Guides AI emoji placement.';

COMMENT ON COLUMN business_brand_profile.storytelling_style IS 
'✅ PRIMARY: Narrative approach - facts_only, some_context, or rich_stories. Guides caption structure depth.';

-- Mark legacy/deprecated fields
COMMENT ON COLUMN business_brand_profile.do_not_say IS 
'⚠️ DEPRECATED (v17): Legacy JSONB structure {words: []}. Replaced by never_say text array. Data consolidated into never_say. Kept for backward compatibility until Q2 2026. DO NOT USE in new code.';

COMMENT ON COLUMN business_brand_profile.things_to_avoid IS 
'⚠️ DEPRECATED (v17): Duplicate of do_not_say. Replaced by never_say text array. Data consolidated into never_say. Kept for backward compatibility until Q2 2026. DO NOT USE in new code.';

COMMENT ON COLUMN business_brand_profile.tone_keywords IS 
'⚠️ LEGACY: Simple tone descriptors like ["hyggelig", "uformel"]. Consider migrating to structured tone_of_voice or using enriched fields (humor_level, formality). Still used in weekly-plan-generator (Phase 1 will deprecate).';

COMMENT ON COLUMN business_brand_profile.voice_style IS 
'⚠️ LEGACY: Free-text voice description like "du-form, emojis ok". Replaced by structured fields (formality, emoji_style). Still used in weekly-plan-generator (Phase 1 will deprecate).';

-- Mark unused fields
COMMENT ON COLUMN business_brand_profile.booking_link IS 
'❌ UNUSED (audit 2026-02-17): No references found in edge functions. May be used in frontend. Candidate for deprecation if truly unused.';

COMMENT ON COLUMN business_brand_profile.business_voice IS 
'❌ UNUSED (audit 2026-02-17): JSONB field never referenced. Likely obsolete structure from early development. Candidate for removal.';

COMMENT ON COLUMN business_brand_profile.cta_preference IS 
'❌ UNUSED (audit 2026-02-17): No references found in content generation flow. May be frontend-only or deprecated.';

-- Mark underused fields
COMMENT ON COLUMN business_brand_profile.content_focus IS 
'⚠️ UNDERUSED: Generated by brand profile system but not passed to AI generation. Consider integrating into strategy/caption context or deprecating.';

COMMENT ON COLUMN business_brand_profile.communication_goal IS 
'⚠️ UNDERUSED: Generated by brand profile system but not passed to AI generation. Consider integrating into strategy/caption context or deprecating.';

COMMENT ON COLUMN business_brand_profile.target_audience IS 
'⚠️ UNDERUSED: Generated by brand profile system but not passed to AI generation. Consider integrating into strategy/caption context or deprecating.';

COMMENT ON COLUMN business_brand_profile.core_offerings IS 
'⚠️ UNDERUSED: Text field generated but not used in AI. offerings_full JSONB is more structured. Consider consolidation.';

-- Mark metadata fields
COMMENT ON COLUMN business_brand_profile.voice_extraction_source IS 
'📊 METADATA: Source of voice data extraction - ai_auto_extract, ai_gpt4o_hybrid, manual, imported. For traceability and confidence scoring.';

COMMENT ON COLUMN business_brand_profile.voice_extracted_at IS 
'📊 METADATA: Timestamp when voice enrichment was last performed. Used to determine freshness and trigger re-extraction.';

COMMENT ON COLUMN business_brand_profile.voice_confidence_score IS 
'📊 METADATA: Confidence score 0-100 for voice extraction quality. Based on evidence strength and data completeness.';

-- =============================================================================
-- STEP 4: POST-CLEANUP VERIFICATION
-- =============================================================================

-- Verify never_say consolidation worked
SELECT 
  business_id,
  COALESCE(array_length(never_say, 1), 0) as never_say_count,
  never_say[1:10] as never_say_first_10,
  
  -- Check if contains Danish phrases (not just English hashtags/cities)
  EXISTS(SELECT 1 FROM unnest(never_say) w WHERE w ~ '[æøå]') as has_danish_words,
  
  -- Verify enriched fields populated
  signature_phrases IS NOT NULL AND array_length(signature_phrases, 1) > 0 as has_signatures,
  typical_openings IS NOT NULL AND array_length(typical_openings, 1) > 0 as has_openings,
  typical_closings IS NOT NULL AND array_length(typical_closings, 1) > 0 as has_closings,
  humor_level IS NOT NULL as has_humor,
  formality IS NOT NULL as has_formality
FROM business_brand_profile
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- =============================================================================
-- STEP 5: GENERATE DATA QUALITY REPORT
-- =============================================================================

-- Overall data quality across all businesses
SELECT 
  COUNT(*) as total_businesses,
  
  -- Enriched field adoption
  COUNT(*) FILTER (WHERE never_say IS NOT NULL AND array_length(never_say, 1) > 0) as has_never_say,
  COUNT(*) FILTER (WHERE signature_phrases IS NOT NULL AND array_length(signature_phrases, 1) > 0) as has_signatures,
  COUNT(*) FILTER (WHERE typical_openings IS NOT NULL AND array_length(typical_openings, 1) > 0) as has_openings,
  COUNT(*) FILTER (WHERE humor_level IS NOT NULL) as has_humor_level,
  COUNT(*) FILTER (WHERE formality IS NOT NULL) as has_formality,
  
  -- Legacy field usage still present
  COUNT(*) FILTER (WHERE do_not_say IS NOT NULL) as still_has_do_not_say,
  COUNT(*) FILTER (WHERE things_to_avoid IS NOT NULL) as still_has_things_to_avoid,
  
  -- Quality metrics
  ROUND(AVG(COALESCE(array_length(never_say, 1), 0))) as avg_never_say_count,
  ROUND(AVG(COALESCE(array_length(signature_phrases, 1), 0))) as avg_signature_count,
  ROUND(AVG(voice_confidence_score)) as avg_confidence_score
FROM business_brand_profile;

-- =============================================================================
-- ROLLBACK PLAN (If Needed)
-- =============================================================================

-- This consolidation is SAFE and backward compatible:
-- 1. We only ADD data to never_say (merge, don't replace)
-- 2. Legacy fields (do_not_say, things_to_avoid) remain unchanged
-- 3. Comments are non-destructive
-- 4. No columns dropped

-- If you need to undo (shouldn't be necessary):
-- COMMENT ON COLUMN business_brand_profile.do_not_say IS NULL;
-- COMMENT ON COLUMN business_brand_profile.things_to_avoid IS NULL;
-- (never_say keeps consolidated data - this is the new source of truth)

-- =============================================================================
-- NOTES FOR PHASE 1 IMPLEMENTATION
-- =============================================================================

-- After this cleanup:
-- ✅ never_say contains all banned words (consolidated)
-- ✅ Schema comments document field status clearly
-- ✅ Legacy fields marked deprecated but still functional
-- ✅ Backward compatible - old code won't break

-- Phase 1 can now:
-- 1. Create unified BrandVoice type using PRIMARY fields
-- 2. Update weekly-plan-generator to pass enriched fields
-- 3. Test with confidence that data is clean and consistent
-- 4. Gradually migrate code away from LEGACY fields

-- =============================================================================
-- EXECUTION INSTRUCTIONS
-- =============================================================================

-- 1. Run STEP 1 (verification) to see current state
-- 2. Run STEP 2 (consolidation) to merge data
-- 3. Run STEP 3 (comments) to document schema
-- 4. Run STEP 4 (verification) to confirm success
-- 5. Run STEP 5 (report) to see overall data quality
-- 6. Proceed with Phase 1 code implementation

-- Execute in Supabase SQL Editor or via psql
