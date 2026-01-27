-- Migration: Add recognizable_interior_identity field
-- Date: 2026-01-06
-- Purpose: Add conditional field for distinctive interior/visual identity (murals, iconic decor, etc.)

-- Add column to business_brand_profile table
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS recognizable_interior_identity TEXT;

-- Add comment explaining conditional nature
COMMENT ON COLUMN business_brand_profile.recognizable_interior_identity IS 
'CONDITIONAL FIELD: Only populated when explicit visual evidence exists (interior photos, labeled images, distinctive decor). Examples: murals, wall art, iconic figures/themes. Empty if no verified evidence. Do NOT infer or use local knowledge.';

-- This field is optional and safe for downstream systems to ignore if empty/null
