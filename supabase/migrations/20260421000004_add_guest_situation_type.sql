-- Add guest_situation_type to business_brand_profile
-- Extracted from photo analysis: who is visible in the photos and what they are doing.
-- Examples: "par ved bord", "grupper", "solo-arbejde", "stående ved baren"
-- Used in get-quick-suggestions and generate-text-from-idea as confirmed social context.

ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS guest_situation_type TEXT;

COMMENT ON COLUMN business_brand_profile.guest_situation_type
  IS 'AI-extracted: visible guest activity/situation in photos (e.g. "par ved bord", "grupper", "solo-arbejde"). Used in content generation as a confirmed social context signal.';
