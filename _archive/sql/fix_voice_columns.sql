-- Quick fix: Add voice pattern columns to production
-- Run this directly in Supabase SQL Editor

ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS voice_execution jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS personality jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS brand_context jsonb DEFAULT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_brand_profile_voice_patterns 
ON business_brand_profile USING gin (voice_execution);

CREATE INDEX IF NOT EXISTS idx_brand_profile_personality 
ON business_brand_profile USING gin (personality);

CREATE INDEX IF NOT EXISTS idx_brand_profile_brand_context 
ON business_brand_profile USING gin (brand_context);

-- Add comments
COMMENT ON COLUMN business_brand_profile.voice_execution IS 
'Authentic voice patterns extracted from owner writing samples';

COMMENT ON COLUMN business_brand_profile.personality IS 
'Personality calibration from actual content';

COMMENT ON COLUMN business_brand_profile.brand_context IS 
'Brand heritage and local context';
