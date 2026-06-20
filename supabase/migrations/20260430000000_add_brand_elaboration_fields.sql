-- Add missing brand profile fields that are being used by the application
-- but were never properly migrated to the database schema

ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS business_character TEXT,
ADD COLUMN IF NOT EXISTS brand_essence_elaboration TEXT;

COMMENT ON COLUMN business_brand_profile.business_character IS 'AI-generated plain-text description of what the business is (prevents product hallucination in content generation)';
COMMENT ON COLUMN business_brand_profile.brand_essence_elaboration IS 'Deterministically-built 2-3 sentence strategic anchor for AI content planning (location, offerings, audience)';
