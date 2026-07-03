-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 0 MIGRATION: Drop do_not_say, Add V5 Metadata
-- ═══════════════════════════════════════════════════════════════════════════
-- Execute this in: Supabase Dashboard > SQL Editor
-- URL: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
--
-- SAFE TO RUN: All operations use IF EXISTS / IF NOT EXISTS
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Drop do_not_say column (verified NULL in 100% of rows)
ALTER TABLE business_brand_profile 
  DROP COLUMN IF EXISTS do_not_say;

-- 2. Add V5 metadata columns
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS voice_v5_migrated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS voice_v5_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voice_v5_version TEXT DEFAULT 'v5.0';

-- 3. Add protection comments (prevent future deletion attempts)
COMMENT ON COLUMN business_brand_profile.voice_v5_migrated IS 
  'TRUE if voice data has been integrated into brand_profile_v5 JSONB';

COMMENT ON COLUMN business_brand_profile.typical_openings IS 
  'ACTIVELY USED - DO NOT DELETE - 25 code refs, 100% populated. Example opening sentences for brand voice.';

COMMENT ON COLUMN business_brand_profile.typical_closings IS 
  'ACTIVELY USED - DO NOT DELETE - 20 code refs, 67% populated. Example closing CTAs for brand voice.';

COMMENT ON COLUMN business_brand_profile.tone_keywords IS 
  'FALLBACK FIELD - DO NOT DELETE - 15 code refs. Used when tone_model.primary_keywords is empty.';

COMMENT ON COLUMN business_brand_profile.never_say IS 
  'Word-level guardrails (e.g., "morgenmad → brunch"). Replaces old do_not_say field.';

-- 4. Verify migration succeeded
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'business_brand_profile' AND column_name = 'do_not_say'
    )
    THEN '❌ ERROR: do_not_say still exists'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'business_brand_profile' AND column_name = 'voice_v5_migrated'
    )
    THEN '✅ SUCCESS: Migration complete'
    ELSE '❌ ERROR: voice_v5_migrated not found'
  END as migration_status;
