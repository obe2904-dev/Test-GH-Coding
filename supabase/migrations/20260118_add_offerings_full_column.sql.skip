-- Migration: Add offerings_full column for full explainability of core offering candidates
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS offerings_full JSONB;

COMMENT ON COLUMN business_brand_profile.offerings_full IS 'All core offering candidates, scores, and evidence for explainability.';
