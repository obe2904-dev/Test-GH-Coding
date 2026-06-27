-- Add price_positioning column to business_programme_profiles table
-- V5.3 enhancement: Per-programme price positioning for tone calibration

ALTER TABLE business_programme_profiles 
ADD COLUMN IF NOT EXISTS price_positioning JSONB;

-- Add comment
COMMENT ON COLUMN business_programme_profiles.price_positioning IS 
'V5.3: Programme-specific price positioning for content tone calibration. 
Structure: {tier: "budget|value|moderate|upscale|premium", min: number, max: number, avg: number, spread: number, sample_count: number}';

-- Create index for queries filtering by price tier
CREATE INDEX IF NOT EXISTS idx_programme_price_tier 
ON business_programme_profiles((price_positioning->>'tier'));

-- Verify column exists
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'business_programme_profiles'
  AND column_name = 'price_positioning';
