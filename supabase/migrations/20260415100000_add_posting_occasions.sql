-- Migration: Add posting_occasions JSONB column + hash to business_brand_profile
-- Stores AI-selected occasion assignments produced by brand-profile-generator Prompt B.
-- Phase 0 reads these weekly and resolves an ActiveOccasion[] with concrete timing.

ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS posting_occasions       JSONB    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS posting_occasions_hash  TEXT     DEFAULT NULL;

COMMENT ON COLUMN business_brand_profile.posting_occasions IS
  'PostingOccasion[] from occasion-library — written once by brand-profile-generator Prompt B, re-written when content_strategy hash changes. Read by get-weekly-strategy Phase 0.';

COMMENT ON COLUMN business_brand_profile.posting_occasions_hash IS
  'MD5 of posting_occasions JSON — used to detect staleness so the field is only regenerated when the occasion list actually changes.';
