-- MIGRATION HELPER: Apply all new brand profile columns
-- Run this in Supabase SQL Editor if `supabase db push` fails

-- 1. Add business_character and brand_essence_elaboration
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS business_character TEXT,
ADD COLUMN IF NOT EXISTS brand_essence_elaboration TEXT;

-- 2. Add audience_framework and voice_system
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS audience_framework JSONB,
ADD COLUMN IF NOT EXISTS voice_system JSONB;

-- 3. Add comments for documentation
COMMENT ON COLUMN business_brand_profile.business_character IS 'Deterministically-built plain-text description of what the business is (prevents product hallucination)';
COMMENT ON COLUMN business_brand_profile.brand_essence_elaboration IS 'Deterministically-built 2-3 sentence strategic anchor (location, offerings, audience)';
COMMENT ON COLUMN business_brand_profile.audience_framework IS 'Multi-dimensional audience framework: { primaryAudiences, locationContexts, timeSlots, seasonalVariation, complexity }';
COMMENT ON COLUMN business_brand_profile.voice_system IS 'Context-adaptive voice system: { primaryArchetype, variations, programmeSpecific, complexity }';
