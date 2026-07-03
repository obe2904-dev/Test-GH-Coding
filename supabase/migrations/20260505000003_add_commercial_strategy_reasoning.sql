-- Migration: Add AI reasoning field for commercial strategy
-- Date: 2026-05-05
-- Purpose: Store AI-generated explanation of commercial strategy recommendations

-- Add reasoning field to business_brand_profile
ALTER TABLE business_brand_profile 
ADD COLUMN commercial_strategy_reasoning TEXT;

COMMENT ON COLUMN business_brand_profile.commercial_strategy_reasoning IS 
'AI-generated explanation of why this commercial configuration was recommended. Generated during brand profile creation.';

-- Add index for businesses that need review (low confidence or no reasoning)
CREATE INDEX idx_commercial_strategy_review 
ON business_brand_profile(business_id) 
WHERE commercial_strategy_reasoning IS NULL OR commercial_baseline_mode IS NULL;

-- Update existing migration-generated configs to note they were auto-generated
UPDATE business_brand_profile
SET 
  commercial_strategy_reasoning = 'Auto-configured based on business characteristics. Regenerate brand profile for AI-analyzed recommendations.',
  trigger_updated_by = 'migration'
WHERE trigger_configuration IS NOT NULL 
  AND commercial_strategy_reasoning IS NULL;
