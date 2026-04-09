-- Comprehensive fix: Add ALL missing columns to business_brand_profile
-- Run this in Supabase SQL Editor to fix the schema

-- Core brand voice columns (from migration 20260106000000)
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS brand_essence TEXT,
ADD COLUMN IF NOT EXISTS tone_of_voice TEXT,
ADD COLUMN IF NOT EXISTS things_to_avoid TEXT,
ADD COLUMN IF NOT EXISTS core_offerings TEXT,
ADD COLUMN IF NOT EXISTS content_focus TEXT,
ADD COLUMN IF NOT EXISTS cta_style TEXT,
ADD COLUMN IF NOT EXISTS communication_goal TEXT,
ADD COLUMN IF NOT EXISTS image_preferences TEXT,
ADD COLUMN IF NOT EXISTS last_edited_by TEXT,
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

-- Voice pattern columns (from migration 20260204000000)
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS voice_execution jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS personality jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS brand_context jsonb DEFAULT NULL;

-- Target audience column (if it doesn't exist as JSONB)
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS target_audience JSONB DEFAULT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_brand_profile_voice_patterns 
ON business_brand_profile USING gin (voice_execution);

CREATE INDEX IF NOT EXISTS idx_brand_profile_personality 
ON business_brand_profile USING gin (personality);

CREATE INDEX IF NOT EXISTS idx_brand_profile_brand_context 
ON business_brand_profile USING gin (brand_context);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
