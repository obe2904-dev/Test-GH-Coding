-- Add audience framework and voice system columns for multi-context awareness
-- These enable time-based, location-based, and seasonal audience targeting
-- and programme-specific voice adaptation for content generation

ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS audience_framework JSONB,
ADD COLUMN IF NOT EXISTS voice_system JSONB;

COMMENT ON COLUMN business_brand_profile.audience_framework IS 'Multi-dimensional audience framework with location contexts, time slots, and seasonal variations. Structure: { primaryAudiences: string[], locationContexts: [{type, score, audiences, seasonal}], timeSlots: [{label, programmes, audiences, contexts}], seasonalVariation: {summer, winter}, complexity }';

COMMENT ON COLUMN business_brand_profile.voice_system IS 'Context-adaptive voice system with programme-specific and time-based variations. Structure: { primaryArchetype, variations: {morning, midday, evening, night}, programmeSpecific: {}, complexity }. Prevents inappropriate imperatives in family contexts, adapts tone based on time of day.';
