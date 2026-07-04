-- ============================================================================
-- MIGRATION: Add Missing Brand Profile Columns
-- ============================================================================
-- Purpose: Add all columns required by brand-profile-generator saveBrandProfile()
-- Date: 2026-06-09
-- Issue: "Could not find the 'tone_of_voice' column" error

-- Add core legacy TEXT columns
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS tone_of_voice TEXT,
  ADD COLUMN IF NOT EXISTS content_focus TEXT,
  ADD COLUMN IF NOT EXISTS communication_goal TEXT,
  ADD COLUMN IF NOT EXISTS target_audience TEXT,
  ADD COLUMN IF NOT EXISTS core_offerings TEXT,
  ADD COLUMN IF NOT EXISTS content_pillars TEXT,
  ADD COLUMN IF NOT EXISTS things_to_avoid TEXT,
  ADD COLUMN IF NOT EXISTS image_preferences TEXT;

-- Add V2 brand profile fields (March 2026)
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS brand_essence_elaboration TEXT,
  ADD COLUMN IF NOT EXISTS identity_keywords TEXT,
  ADD COLUMN IF NOT EXISTS voice_constraints TEXT,
  ADD COLUMN IF NOT EXISTS business_character TEXT,
  ADD COLUMN IF NOT EXISTS voice_rationale TEXT;

-- Add framework/system JSONB columns
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS audience_framework JSONB,
  ADD COLUMN IF NOT EXISTS voice_system JSONB,
  ADD COLUMN IF NOT EXISTS content_strategy JSONB,
  ADD COLUMN IF NOT EXISTS posting_occasions JSONB,
  ADD COLUMN IF NOT EXISTS posting_occasions_hash TEXT;

-- Add new JSONB columns (source of truth)
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS things_to_avoid_jsonb JSONB,
  ADD COLUMN IF NOT EXISTS image_preferences_jsonb JSONB,
  ADD COLUMN IF NOT EXISTS core_offerings_jsonb JSONB,
  ADD COLUMN IF NOT EXISTS content_pillars_jsonb JSONB,
  ADD COLUMN IF NOT EXISTS social_style JSONB,
  ADD COLUMN IF NOT EXISTS voice_examples JSONB,
  ADD COLUMN IF NOT EXISTS tone_model JSONB;

-- Add quality tracking columns
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS quality_status TEXT CHECK (quality_status IN ('green', 'yellow', 'red')),
  ADD COLUMN IF NOT EXISTS generation_errors JSONB,
  ADD COLUMN IF NOT EXISTS version_hash TEXT;

-- Add location intelligence (deterministic)
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS location_intelligence JSONB;

-- Add Stage B0 classification columns
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS business_model_type TEXT,
  ADD COLUMN IF NOT EXISTS primary_copy_hook TEXT,
  ADD COLUMN IF NOT EXISTS audience_breadth TEXT,
  ADD COLUMN IF NOT EXISTS classification_rationale TEXT;

-- Add typical openings (derived from tone_of_voice)
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS typical_openings TEXT[];

-- Add commercial strategy columns (Stage CS)
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS commercial_baseline_mode TEXT,
  ADD COLUMN IF NOT EXISTS trigger_configuration JSONB,
  ADD COLUMN IF NOT EXISTS commercial_strategy_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS trigger_updated_by TEXT,
  ADD COLUMN IF NOT EXISTS trigger_updated_at TIMESTAMPTZ;

-- Add posting strategy columns (Stage PS)
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS posting_strategy JSONB,
  ADD COLUMN IF NOT EXISTS busy_pattern JSONB;

-- Add audience segments column (Stage B5)
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS audience_segments JSONB;

-- Refresh schema cache to make columns immediately available
NOTIFY pgrst, 'reload schema';

-- Verify columns were added
SELECT 
  'Schema Update Verification' as test_name,
  COUNT(*) FILTER (WHERE column_name = 'tone_of_voice') as has_tone_of_voice,
  COUNT(*) FILTER (WHERE column_name = 'content_focus') as has_content_focus,
  COUNT(*) FILTER (WHERE column_name = 'tone_model') as has_tone_model,
  COUNT(*) FILTER (WHERE column_name = 'location_intelligence') as has_location_intelligence,
  COUNT(*) as total_columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_brand_profile';

-- Show sample row to confirm structure
SELECT 
  business_id,
  brand_essence IS NOT NULL as has_brand_essence,
  tone_of_voice IS NOT NULL as has_tone_of_voice,
  tone_model IS NOT NULL as has_tone_model,
  content_focus IS NOT NULL as has_content_focus
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
