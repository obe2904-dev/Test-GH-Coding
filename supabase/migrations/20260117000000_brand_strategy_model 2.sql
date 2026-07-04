-- Brand Strategy Model Migration
-- Implements the locked four-layer strategy model for Post2Grow

-- ============================================================================
-- STEP 1: Add locale to businesses table
-- ============================================================================

ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS locale text DEFAULT 'da-DK';

COMMENT ON COLUMN businesses.locale IS 'Business locale for content generation (e.g., da-DK, en-US)';

-- ============================================================================
-- STEP 2: Update business_brand_profile to store strategy model
-- ============================================================================

-- Drop existing columns if they have wrong type, then add with correct type
ALTER TABLE business_brand_profile
DROP COLUMN IF EXISTS core_offerings CASCADE,
DROP COLUMN IF EXISTS offerings_weights CASCADE,
DROP COLUMN IF EXISTS offerings_reasoning CASCADE,
DROP COLUMN IF EXISTS offerings_confidence CASCADE,
DROP COLUMN IF EXISTS target_audience_primary CASCADE,
DROP COLUMN IF EXISTS target_audience_seasonal CASCADE,
DROP COLUMN IF EXISTS audience_reasoning CASCADE,
DROP COLUMN IF EXISTS audience_confidence CASCADE,
DROP COLUMN IF EXISTS communication_goal CASCADE,
DROP COLUMN IF EXISTS goal_reasoning CASCADE,
DROP COLUMN IF EXISTS goal_confidence CASCADE,
DROP COLUMN IF EXISTS strategy_version CASCADE,
DROP COLUMN IF EXISTS generated_at CASCADE,
DROP COLUMN IF EXISTS approved_by_user CASCADE;

-- Add new strategy fields with correct types
ALTER TABLE business_brand_profile
ADD COLUMN core_offerings text[],
ADD COLUMN offerings_weights jsonb DEFAULT '{}'::jsonb,
ADD COLUMN offerings_reasoning text[],
ADD COLUMN offerings_confidence text,

ADD COLUMN target_audience_primary text[],
ADD COLUMN target_audience_seasonal jsonb DEFAULT '[]'::jsonb,
ADD COLUMN audience_reasoning text[],
ADD COLUMN audience_confidence text,

ADD COLUMN communication_goal text,
ADD COLUMN goal_reasoning text[],
ADD COLUMN goal_confidence text,

ADD COLUMN strategy_version text,
ADD COLUMN generated_at timestamptz,
ADD COLUMN approved_by_user boolean DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN business_brand_profile.core_offerings IS 'Layer 1: Top 3 identity patterns (WHAT defines business)';
COMMENT ON COLUMN business_brand_profile.offerings_weights IS 'Deterministic weights for all calculated offerings';
COMMENT ON COLUMN business_brand_profile.target_audience_primary IS 'Layer 2: Max 2 primary audiences from fixed pool';
COMMENT ON COLUMN business_brand_profile.target_audience_seasonal IS 'Additive seasonal audience modifiers';
COMMENT ON COLUMN business_brand_profile.communication_goal IS 'Layer 3: Exactly one goal from fixed pool (drive_visits, increase_bookings, build_local_awareness, fill_off_peak)';
COMMENT ON COLUMN business_brand_profile.strategy_version IS 'Strategy model version for tracking changes';
COMMENT ON COLUMN business_brand_profile.approved_by_user IS 'User has reviewed and approved the generated strategy';

-- ============================================================================
-- STEP 3: Add constraints for data integrity
-- ============================================================================

-- Validate core offerings (max 3)
ALTER TABLE business_brand_profile
ADD CONSTRAINT check_core_offerings_max_3 
CHECK (core_offerings IS NULL OR array_length(core_offerings, 1) IS NULL OR array_length(core_offerings, 1) <= 3);

-- Validate primary audiences (max 2, from fixed pool)
ALTER TABLE business_brand_profile
ADD CONSTRAINT check_primary_audiences_max_2 
CHECK (target_audience_primary IS NULL OR array_length(target_audience_primary, 1) IS NULL OR array_length(target_audience_primary, 1) <= 2);

ALTER TABLE business_brand_profile
ADD CONSTRAINT check_primary_audiences_valid 
CHECK (
  target_audience_primary IS NULL OR 
  target_audience_primary <@ ARRAY['locals', 'families', 'office_workers', 'students', 'social_groups', 'tourists']::text[]
);

-- Validate communication goal (must be from fixed pool)
ALTER TABLE business_brand_profile
ADD CONSTRAINT check_communication_goal_valid 
CHECK (
  communication_goal IS NULL OR 
  communication_goal IN ('drive_visits', 'increase_bookings', 'build_local_awareness', 'fill_off_peak')
);

-- Validate confidence levels
ALTER TABLE business_brand_profile
ADD CONSTRAINT check_offerings_confidence_valid 
CHECK (offerings_confidence IS NULL OR offerings_confidence IN ('high', 'medium', 'low'));

ALTER TABLE business_brand_profile
ADD CONSTRAINT check_audience_confidence_valid 
CHECK (audience_confidence IS NULL OR audience_confidence IN ('high', 'medium', 'low'));

ALTER TABLE business_brand_profile
ADD CONSTRAINT check_goal_confidence_valid 
CHECK (goal_confidence IS NULL OR goal_confidence IN ('high', 'medium', 'low'));

-- ============================================================================
-- STEP 4: Create index for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_brand_profile_generated_at 
ON business_brand_profile(generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_profile_approved 
ON business_brand_profile(approved_by_user);

-- ============================================================================
-- STEP 5: Update existing records with defaults
-- ============================================================================

-- Set strategy_version for existing records
UPDATE business_brand_profile 
SET strategy_version = '1.0.0' 
WHERE strategy_version IS NULL;

-- Set default locale for existing businesses
UPDATE businesses 
SET locale = 'da-DK' 
WHERE locale IS NULL;
