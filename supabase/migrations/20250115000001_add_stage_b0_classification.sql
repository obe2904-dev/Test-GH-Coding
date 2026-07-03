-- Migration: Add Stage B0 business model classification columns
-- Purpose: Store pre-classification results from Stage B0 (GPT-4o-mini) to optimize Stage B5
-- Fields: business_model_type, primary_copy_hook, audience_breadth, classification_rationale
-- Author: AI refactoring - prompt extraction initiative
-- Date: 2025-01-15

-- Add Stage B0 classification columns to business_brand_profile
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS business_model_type TEXT,
  ADD COLUMN IF NOT EXISTS primary_copy_hook TEXT,
  ADD COLUMN IF NOT EXISTS audience_breadth TEXT,
  ADD COLUMN IF NOT EXISTS classification_rationale TEXT;

-- Add comments for documentation
COMMENT ON COLUMN business_brand_profile.business_model_type IS 'Stage B0: Business model classification (offer_led | occasion_led | destination_led | audience_led)';
COMMENT ON COLUMN business_brand_profile.primary_copy_hook IS 'Stage B0: Primary marketing hook (product | location | programme | identity)';
COMMENT ON COLUMN business_brand_profile.audience_breadth IS 'Stage B0: Target audience scope (narrow | mixed | broad)';
COMMENT ON COLUMN business_brand_profile.classification_rationale IS 'Stage B0: One-sentence rationale for the classification decision';
