-- Migration: Add location_intelligence column to business_brand_profile
--
-- Purpose: Stores deterministic location intelligence derived from
--          business_locations.category_scores + location_marketing_hooks.
--          Zero AI latency — computed and saved by brand-profile-generator
--          at generation time, queryable directly by the post generator.
--
-- Schema:  JSONB matching the LocationIntelligence TypeScript interface:
--   {
--     "primary_type":          string,     -- e.g. "waterfront"
--     "matched_motivations":   string[],   -- e.g. ["destinationsbesøg", "romantisk_stemning"]
--     "marketing_focus":       string|null,-- e.g. "Fremhæv brunchtilbud til turister"
--     "secondary_types":       string[],   -- e.g. ["tourist", "city_centre"]
--     "tourist_context":       boolean     -- true → bilingual variant awareness
--   }
--
-- Usage by post generator:
--   season=summer + motivation=familieudflug  → family outdoor copy
--   tourist_context=true + month=july         → bilingual variant
--   motivation=romantisk_stemning + friday    → evening romantik angle

ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS location_intelligence JSONB DEFAULT NULL;

-- Optional: index for fast filtering/querying by location type
CREATE INDEX IF NOT EXISTS idx_bbp_location_intelligence_primary_type
  ON business_brand_profile
  USING GIN (location_intelligence);

-- Comment for documentation
COMMENT ON COLUMN business_brand_profile.location_intelligence IS
  'Deterministic location intelligence (no AI). Derived from business_locations.category_scores '
  'and location_marketing_hooks at brand profile generation time. '
  'Fields: primary_type, matched_motivations[], marketing_focus, secondary_types[], tourist_context.';
