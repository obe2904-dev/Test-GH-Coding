-- Migration: 20260508_integrate_voice_v5.sql
-- OPTION C: Integration approach - minimal deletions, maximum preservation
-- Date: May 8, 2026
-- Purpose: Delete ONLY truly dead field (do_not_say), add V5 integration metadata

-- ═══════════════════════════════════════════════════════════
-- PART 1: REMOVE ONLY TRULY DEAD FIELD
-- ═══════════════════════════════════════════════════════════

-- Delete do_not_say (verified NULL in 100% of rows via audit)
ALTER TABLE business_brand_profile 
  DROP COLUMN IF EXISTS do_not_say;

-- NOTE: Keeping these fields (contrary to original Option B plan):
--   ✅ typical_openings  (100% populated, 25 code references - ACTIVELY USED!)
--   ✅ typical_closings  (67% populated, 20 code references - ACTIVELY USED!)
--   ✅ tone_keywords     (33% populated, 15 code references - fallback logic)
--   ⚠️ voice_options     (33% populated - pending Sprint 1 investigation)
--
-- Reason: Database audit (May 8, 2026) revealed these fields are production-critical.
-- See: PHASE-0-AUDIT-RESULTS.md for full analysis.

-- ═══════════════════════════════════════════════════════════
-- PART 2: ADD V5 INTEGRATION METADATA
-- ═══════════════════════════════════════════════════════════

-- Track V5 migration status per business
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS voice_v5_migrated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS voice_v5_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voice_v5_version TEXT DEFAULT 'v5.0';

COMMENT ON COLUMN business_brand_profile.voice_v5_migrated IS 
  'TRUE if voice data has been integrated into brand_profile_v5 JSONB. FALSE if still using legacy columns only.';

COMMENT ON COLUMN business_brand_profile.voice_v5_generated_at IS 
  'Timestamp when voice data was integrated/generated into V5 format.';

COMMENT ON COLUMN business_brand_profile.voice_v5_version IS 
  'Version of V5 voice generation used. v5.0 = initial integration, v5.1+ = future enhancements.';

-- ═══════════════════════════════════════════════════════════
-- PART 3: ADD INTEGRATION COMMENTS (CRITICAL FOR FUTURE DEVS)
-- ═══════════════════════════════════════════════════════════

-- Prevent future deletion attempts by documenting active usage
COMMENT ON COLUMN business_brand_profile.typical_openings IS 
  'Example opening sentences for brand voice (e.g., "Denne uge på Restaurant Klokken").
   
   STATUS: ACTIVELY USED by production systems.
   - Weekly Plan generator (generate-weekly-plan/index.ts)
   - Weekly Strategy (get-weekly-strategy/index.ts)
   - Post Helpers (phase2b.ts, phase2c.ts)
   - Content Generation (resolve-context.ts)
   
   V5 INTEGRATION: Copied to brand_profile_v5.writing_examples.typical_openings.
   MIGRATION STRATEGY: Preserve existing data (100% populated). Only AI-generate if NULL.
   
   ⚠️  DO NOT DELETE - 25 code references, 100% populated across businesses.';

COMMENT ON COLUMN business_brand_profile.typical_closings IS 
  'Example closing CTAs for brand voice (e.g., "Book dit bord", "Kom forbi i dag").
   
   STATUS: ACTIVELY USED by production systems.
   - Weekly Plan generator
   - CTA selection (select-cta.ts)
   - Post Helpers (phase2b.ts)
   
   V5 INTEGRATION: Copied to brand_profile_v5.writing_examples.typical_closings.
   MIGRATION STRATEGY: Preserve existing data (67% populated). AI-generate if NULL.
   
   ⚠️  DO NOT DELETE - 20 code references, 67% populated across businesses.';

COMMENT ON COLUMN business_brand_profile.tone_keywords IS 
  'Simple personality keywords (e.g., ["Raffineret", "Passioneret", "Autentisk"]).
   
   STATUS: USED AS FALLBACK in production.
   - Quick Suggestions uses when tone_model.primary_keywords is empty
   - Weekly Plan generator fallback
   
   V5 INTEGRATION: Referenced as fallback, not directly copied.
   MIGRATION STRATEGY: Keep field for backward compatibility.
   
   ⚠️  DO NOT DELETE - 15 code references, critical fallback logic.';

COMMENT ON COLUMN business_brand_profile.never_say IS 
  'Word-level guardrails in format: "banned word → replacement".
   Examples: "morgenmad → brunch", "billig → god værdi"
   
   STATUS: ACTIVELY USED by content generation.
   HISTORICAL NOTE: Consolidated from old never_say + do_not_say.words (deleted May 8, 2026).
   
   V5 INTEGRATION: Copied to brand_profile_v5.guardrails.never_say.
   MIGRATION STRATEGY: Direct copy, preserve all existing rules.';

COMMENT ON COLUMN business_brand_profile.signature_phrases IS 
  'Brand-specific phrases (e.g., "ved åen", "hjemmelavet granola").
   
   V5 INTEGRATION: Copied to brand_profile_v5.writing_examples.signature_phrases.
   MIGRATION STRATEGY: Direct copy.';

COMMENT ON COLUMN business_brand_profile.voice_options IS 
  'LEGACY: Dual-voice paradigm from old brand profile generator.
   Format: {"options": {"website": {...}, "ai_enriched": {...}}}
   
   HISTORICAL CONTEXT:
   - Sprint 1 intended to remove this field (complexity reduction)
   - Database audit (May 8, 2026) found 33% of businesses still have data
   - 10 code references exist (mostly commented out)
   
   STATUS: ⚠️  PENDING INVESTIGATION
   - Verify Sprint 1 migration completion status
   - Check if residual data or incomplete migration
   
   V5 INTEGRATION: Not used - V5 uses single-voice paradigm.
   
   ⚠️  DO NOT DELETE until Sprint 1 investigation complete.';

-- ═══════════════════════════════════════════════════════════
-- PART 4: VALIDATION QUERIES
-- ═══════════════════════════════════════════════════════════

-- Verify do_not_say was deleted
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'business_brand_profile' 
    AND column_name = 'do_not_say'
  ) THEN
    RAISE EXCEPTION 'Migration failed: do_not_say column still exists';
  END IF;
END $$;

-- Verify V5 metadata columns were added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'business_brand_profile' 
    AND column_name = 'voice_v5_migrated'
  ) THEN
    RAISE EXCEPTION 'Migration failed: voice_v5_migrated column not created';
  END IF;
END $$;

-- Verify critical fields were NOT deleted
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'business_brand_profile' 
    AND column_name = 'typical_openings'
  ) THEN
    RAISE EXCEPTION 'Critical error: typical_openings was deleted! This breaks production.';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'business_brand_profile' 
    AND column_name = 'typical_closings'
  ) THEN
    RAISE EXCEPTION 'Critical error: typical_closings was deleted! This breaks production.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 5: AUDIT LOG
-- ═══════════════════════════════════════════════════════════

-- Log migration execution
INSERT INTO schema_migrations_log (
  migration_name,
  executed_at,
  description
) VALUES (
  '20260508_integrate_voice_v5',
  NOW(),
  'Option C integration approach: Delete do_not_say only, preserve working fields (typical_openings, typical_closings, tone_keywords). Add V5 metadata tracking.'
);

-- ═══════════════════════════════════════════════════════════
-- POST-MIGRATION SUMMARY
-- ═══════════════════════════════════════════════════════════

-- Display summary of changes
SELECT 
  'Migration complete!' as status,
  44 - 1 as final_column_count,
  '1 field deleted (do_not_say)' as deleted,
  '3 metadata columns added' as added,
  '5 critical fields preserved' as preserved;

-- Display field preservation status
SELECT 
  column_name,
  CASE 
    WHEN column_name = 'do_not_say' THEN '❌ DELETED (NULL everywhere)'
    WHEN column_name IN ('typical_openings', 'typical_closings', 'tone_keywords', 'voice_options') 
      THEN '✅ PRESERVED (actively used)'
    WHEN column_name IN ('voice_v5_migrated', 'voice_v5_generated_at', 'voice_v5_version')
      THEN '🆕 ADDED (V5 tracking)'
    ELSE '—'
  END as migration_action
FROM information_schema.columns
WHERE table_name = 'business_brand_profile'
  AND column_name IN (
    'do_not_say', 'typical_openings', 'typical_closings', 'tone_keywords', 'voice_options',
    'voice_v5_migrated', 'voice_v5_generated_at', 'voice_v5_version'
  )
ORDER BY 
  CASE column_name
    WHEN 'do_not_say' THEN 1
    WHEN 'typical_openings' THEN 2
    WHEN 'typical_closings' THEN 3
    WHEN 'tone_keywords' THEN 4
    WHEN 'voice_options' THEN 5
    ELSE 6
  END;

-- ═══════════════════════════════════════════════════════════
-- ROLLBACK PLAN
-- ═══════════════════════════════════════════════════════════

-- If rollback needed, run:
--
-- ALTER TABLE business_brand_profile
--   ADD COLUMN IF NOT EXISTS do_not_say JSONB;
-- 
-- ALTER TABLE business_brand_profile
--   DROP COLUMN IF EXISTS voice_v5_migrated,
--   DROP COLUMN IF EXISTS voice_v5_generated_at,
--   DROP COLUMN IF EXISTS voice_v5_version;
--
-- Note: do_not_say data cannot be restored (was NULL everywhere).
