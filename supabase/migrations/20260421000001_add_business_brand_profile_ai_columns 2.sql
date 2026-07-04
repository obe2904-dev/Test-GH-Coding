-- Add AI-generated columns to business_brand_profile
-- These columns are written by saveBrandProfile() in database.ts but were
-- never added via migration, causing silent data loss on every generation.

ALTER TABLE business_brand_profile
  -- V2 Brand Profile fields (plain text descriptors consumed by post generation)
  ADD COLUMN IF NOT EXISTS brand_essence_elaboration  TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS identity_keywords          TEXT[]  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS voice_constraints          TEXT    DEFAULT NULL,

  -- Plain-text business descriptor used as WeekContext.business_character
  ADD COLUMN IF NOT EXISTS business_character         TEXT    DEFAULT NULL,

  -- Content strategy (goal_mode, content_category_weights, brand_anchors)
  -- Written once on first generation; protected against overwrite in application logic
  ADD COLUMN IF NOT EXISTS content_strategy           JSONB   DEFAULT NULL,

  -- Voice archetype options — two bespoke archetypes (recommended + alternative)
  ADD COLUMN IF NOT EXISTS voice_options              JSONB   DEFAULT NULL,

  -- Active archetype key (= recommended on first generation)
  ADD COLUMN IF NOT EXISTS voice_archetype            TEXT    DEFAULT NULL,

  -- JSONB source-of-truth columns (the legacy TEXT columns already exist in base schema)
  ADD COLUMN IF NOT EXISTS things_to_avoid_jsonb      JSONB   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS image_preferences_jsonb    JSONB   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS core_offerings_jsonb       JSONB   DEFAULT NULL,

  -- Location intelligence snapshot stored alongside the brand profile
  -- (separate from business_location_intelligence table — this is a denormalised snapshot)
  ADD COLUMN IF NOT EXISTS location_intelligence      JSONB   DEFAULT NULL;

COMMENT ON COLUMN business_brand_profile.brand_essence_elaboration IS 'Extended elaboration of brand_essence; adds depth without replacing the short form';
COMMENT ON COLUMN business_brand_profile.identity_keywords IS 'Core identity keywords array (3-6 words) used as brand anchors';
COMMENT ON COLUMN business_brand_profile.voice_constraints IS 'Hard rules for what voice/tone must avoid';
COMMENT ON COLUMN business_brand_profile.business_character IS 'Plain-text descriptor of what the business IS; consumed by WeekContext to prevent hallucination';
COMMENT ON COLUMN business_brand_profile.content_strategy IS 'AI-generated strategy: goal_mode split, content_category_weights, brand_anchors. Protected: written once.';
COMMENT ON COLUMN business_brand_profile.voice_options IS 'Two bespoke voice archetypes generated for this business (recommended + alternative)';
COMMENT ON COLUMN business_brand_profile.voice_archetype IS 'Active archetype key; set to recommended on first generation, changeable by owner';
COMMENT ON COLUMN business_brand_profile.things_to_avoid_jsonb IS 'JSONB source of truth for things_to_avoid (legacy TEXT column kept for backwards compatibility)';
COMMENT ON COLUMN business_brand_profile.image_preferences_jsonb IS 'JSONB source of truth for image_preferences (legacy TEXT column kept for backwards compatibility)';
COMMENT ON COLUMN business_brand_profile.core_offerings_jsonb IS 'Structured JSONB for core_offerings: meal_anchors, experience_service_anchors, unknowns';
COMMENT ON COLUMN business_brand_profile.location_intelligence IS 'Denormalised location intelligence snapshot written during brand profile generation';
