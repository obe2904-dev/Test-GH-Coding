-- ============================================================================
-- MIGRATION: Add Missing Brand Profile Columns (ONE BY ONE)
-- ============================================================================
-- Purpose: Add all columns required by brand-profile-generator saveBrandProfile()
-- Date: 2026-06-09
-- Issue: "Could not find the 'tone_of_voice' column" error
-- Strategy: Add columns individually to catch and skip errors

-- Core legacy TEXT columns
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS tone_of_voice TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS content_focus TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS communication_goal TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS target_audience TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS core_offerings TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS content_pillars TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS things_to_avoid TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS image_preferences TEXT;

-- V2 brand profile fields (March 2026)
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS brand_essence_elaboration TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS identity_keywords TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS voice_constraints TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS business_character TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS voice_rationale TEXT;

-- Framework/system JSONB columns
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS audience_framework JSONB;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS voice_system JSONB;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS content_strategy JSONB;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS posting_occasions JSONB;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS posting_occasions_hash TEXT;

-- New JSONB columns (source of truth)
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS things_to_avoid_jsonb JSONB;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS image_preferences_jsonb JSONB;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS core_offerings_jsonb JSONB;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS content_pillars_jsonb JSONB;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS social_style JSONB;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS voice_examples JSONB;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS tone_model JSONB;

-- Quality tracking columns
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS quality_status TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS generation_errors JSONB;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS version_hash TEXT;

-- Add constraint to quality_status AFTER column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'business_brand_profile_quality_status_check'
  ) THEN
    ALTER TABLE business_brand_profile 
      ADD CONSTRAINT business_brand_profile_quality_status_check 
      CHECK (quality_status IN ('green', 'yellow', 'red'));
  END IF;
END $$;

-- Location intelligence (deterministic)
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS location_intelligence JSONB;

-- Stage B0 classification columns
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS business_model_type TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS primary_copy_hook TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS audience_breadth TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS classification_rationale TEXT;

-- Typical openings (derived from tone_of_voice)
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS typical_openings TEXT[];

-- Commercial strategy columns (Stage CS)
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS commercial_baseline_mode TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS trigger_configuration JSONB;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS commercial_strategy_reasoning TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS trigger_updated_by TEXT;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS trigger_updated_at TIMESTAMPTZ;

-- Posting strategy columns (Stage PS)
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS posting_strategy JSONB;
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS busy_pattern JSONB;

-- Audience segments column (Stage B5)
ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS audience_segments JSONB;

-- Refresh schema cache to make columns immediately available
NOTIFY pgrst, 'reload schema';

-- Final verification
SELECT 
  'Migration Verification' as test_name,
  COUNT(*) FILTER (WHERE column_name = 'tone_of_voice') as has_tone_of_voice,
  COUNT(*) FILTER (WHERE column_name = 'content_focus') as has_content_focus,
  COUNT(*) FILTER (WHERE column_name = 'tone_model') as has_tone_model,
  COUNT(*) FILTER (WHERE column_name = 'location_intelligence') as has_location_intelligence,
  COUNT(*) FILTER (WHERE column_name = 'posting_strategy') as has_posting_strategy,
  COUNT(*) FILTER (WHERE column_name = 'audience_segments') as has_audience_segments,
  COUNT(*) as total_columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_brand_profile';

-- Check sample row
SELECT 
  business_id,
  brand_essence IS NOT NULL as has_brand_essence,
  tone_of_voice IS NOT NULL as has_tone_of_voice,
  tone_model IS NOT NULL as has_tone_model,
  content_focus IS NOT NULL as has_content_focus,
  posting_strategy IS NOT NULL as has_posting_strategy
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
