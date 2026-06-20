-- Drop dead column from business_brand_profile.
-- Verified in the April 2026 dead-code audit.
--
--   sample_posts  — historical Tier 1 tone signal; empty for all live businesses
--                   and not consumed by any content pipeline (generate-text-from-idea,
--                   get-quick-suggestions, generate-weekly-plan).
--
-- Note: caption_examples is stored inside owner_document JSONB (not a column).
--       content_rotation_note is stored inside audience_segments JSONB (not a column).
--       Dead code writing those JSONB keys is removed in the same commit.

ALTER TABLE business_brand_profile
  DROP COLUMN IF EXISTS sample_posts;
