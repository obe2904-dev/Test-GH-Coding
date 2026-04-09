-- =====================================================
-- Voice Archetype Selection columns
-- Part of the Voice Archetype Selection feature
-- 
-- voice_options: stores both AI-generated archetype options (recommended + alternative)
--   Schema: { recommended: string, recommended_reason: string,
--             options: { [archetypeKey]: VoiceArchetypeOption } }
--
-- voice_archetype: current active archetype key
--   One of: 'direkte', 'fortaeller', 'curated', 'energisk'
--   Written on first generation (= recommended archetype)
--   Updated when owner chooses alternative via "Skift stemme"
-- =====================================================

ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS voice_options  JSONB,
  ADD COLUMN IF NOT EXISTS voice_archetype TEXT;

COMMENT ON COLUMN business_brand_profile.voice_options IS
  'Both AI-generated voice archetype options. Schema: { recommended, recommended_reason, options: { [key]: { label, description, tone_model, things_to_avoid, voice_constraints, example_posts } } }';

COMMENT ON COLUMN business_brand_profile.voice_archetype IS
  'Currently active voice archetype key. One of: direkte, fortaeller, curated, energisk. Defaults to recommended on first generation.';
