-- Add visual_character column to business_brand_profile
-- Stores a short concept label (formality + concept type) derived from photo analysis.
-- Separate from recognizable_interior_identity (physical inventory) so the two
-- serve different downstream purposes: physical facts vs. tone calibration.

ALTER TABLE "public"."business_brand_profile"
  ADD COLUMN IF NOT EXISTS "visual_character" "text";

COMMENT ON COLUMN "public"."business_brand_profile"."visual_character" IS
  'Short concept label from photo analysis: formality level + concept type (e.g. "Casual industriel café", "Poleret moderne bistro"). No sensory impressions.';
