-- V5 Essential Tables - Manual Migration
-- Execute this on production database to enable V5 generator
-- Date: 2. juni 2026

-- =====================================================
-- MIGRATION 1: Create business_programme_profiles table
-- =====================================================

CREATE TABLE IF NOT EXISTS business_programme_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  programme_type text NOT NULL,
  
  -- LAYER 1: Programme Detection (deterministic)
  programme_name text NOT NULL,
  time_windows text[] NOT NULL DEFAULT '{}',
  operating_days text[] NOT NULL DEFAULT '{}',
  menu_evidence text[] NOT NULL DEFAULT '{}',
  confidence numeric,
  
  -- LAYER 2: Commercial Orientation (AI-generated per programme)
  baseline_goal_split jsonb,
  decision_timing text,
  content_type_affinity jsonb,
  
  -- LAYER 4: Audience Segmentation (AI-generated per programme)
  audience_segments jsonb,
  segment_confidence numeric,
  segment_reasoning text,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version_hash text,
  generation_errors jsonb,
  
  UNIQUE(business_id, programme_type)
);

CREATE INDEX IF NOT EXISTS idx_business_programme_profiles_business_id 
  ON business_programme_profiles(business_id);

CREATE INDEX IF NOT EXISTS idx_business_programme_profiles_programme_type 
  ON business_programme_profiles(programme_type);

CREATE INDEX IF NOT EXISTS idx_business_programme_profiles_updated_at 
  ON business_programme_profiles(updated_at DESC);

ALTER TABLE business_programme_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own programme profiles"
  ON business_programme_profiles
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can manage their own programme profiles"
  ON business_programme_profiles
  FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_business_programme_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_business_programme_profiles_updated_at ON business_programme_profiles;
CREATE TRIGGER update_business_programme_profiles_updated_at
  BEFORE UPDATE ON business_programme_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_business_programme_profiles_updated_at();

-- =====================================================
-- MIGRATION 2: Add positioning column (Layer 3)
-- =====================================================

ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS positioning TEXT DEFAULT NULL;

COMMENT ON COLUMN business_brand_profile.positioning IS 
'Layer 3: Business-level competitive differentiation (2-3 sentences)';

-- =====================================================
-- MIGRATION 3: Add Layer 3 fields
-- =====================================================

ALTER TABLE business_brand_profile 
ADD COLUMN IF NOT EXISTS core_values JSONB,
ADD COLUMN IF NOT EXISTS what_makes_us_different TEXT,
ADD COLUMN IF NOT EXISTS identity_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS identity_reasoning TEXT;

COMMENT ON COLUMN business_brand_profile.core_values IS 'Layer 3: AI-generated core values array';
COMMENT ON COLUMN business_brand_profile.what_makes_us_different IS 'Layer 3: AI-generated differentiation statement';
COMMENT ON COLUMN business_brand_profile.identity_confidence IS 'Layer 3: AI confidence score 0.00-1.00';
COMMENT ON COLUMN business_brand_profile.identity_reasoning IS 'Layer 3: AI reasoning for identity decisions';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'business_programme_profiles'
    ) 
    THEN '✅ business_programme_profiles table created'
    ELSE '❌ business_programme_profiles table MISSING'
  END AS table_status;

-- Check columns exist
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'business_brand_profile'
  AND column_name IN ('positioning', 'core_values', 'what_makes_us_different', 'identity_confidence', 'identity_reasoning')
ORDER BY column_name;
