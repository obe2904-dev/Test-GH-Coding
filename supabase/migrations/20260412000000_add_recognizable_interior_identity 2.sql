-- Add recognizable_interior_identity column to business_brand_profile
-- This stores the AI-generated atmosphere/interior description from photo analysis

ALTER TABLE "public"."business_brand_profile"
  ADD COLUMN IF NOT EXISTS "recognizable_interior_identity" "text";

COMMENT ON COLUMN "public"."business_brand_profile"."recognizable_interior_identity" IS
  'AI-generated atmosphere and interior identity description from photo analysis (visual identity feature)';
