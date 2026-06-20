-- ============================================================================
-- FIX: Brand Profile - Add business_programme_profiles Table
-- ============================================================================
-- Error: "Could not find the table 'public.business_programme_profiles' in the schema cache"
-- Solution: Apply missing migration + refresh schema cache
-- ============================================================================

-- Step 1: Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name = 'business_programme_profiles'
) AS table_exists;

-- If table_exists = false, run the migration below:

-- ============================================================================
-- MIGRATION: Create business_programme_profiles table
-- ============================================================================

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
  
  -- Constraints
  UNIQUE(business_id, programme_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_business_programme_profiles_business_id 
  ON business_programme_profiles(business_id);

CREATE INDEX IF NOT EXISTS idx_business_programme_profiles_programme_type 
  ON business_programme_profiles(programme_type);

CREATE INDEX IF NOT EXISTS idx_business_programme_profiles_updated_at 
  ON business_programme_profiles(updated_at DESC);

-- RLS policies
ALTER TABLE business_programme_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own programme profiles" ON business_programme_profiles;
DROP POLICY IF EXISTS "Users can manage their own programme profiles" ON business_programme_profiles;

CREATE POLICY "Users can view their own programme profiles"
  ON business_programme_profiles
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own programme profiles"
  ON business_programme_profiles
  FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Auto-update updated_at timestamp
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

-- Comments
COMMENT ON TABLE business_programme_profiles IS 'Programme-level brand profile data (Layers 1, 2, 4)';
COMMENT ON COLUMN business_programme_profiles.programme_type IS 'Type of dining programme (brunch, lunch, dinner, bar)';
COMMENT ON COLUMN business_programme_profiles.baseline_goal_split IS 'Layer 2: % split between drive_footfall, strengthen_brand, retain_regulars';
COMMENT ON COLUMN business_programme_profiles.audience_segments IS 'Layer 4: Array of audience segments specific to this programme';

-- ============================================================================
-- Step 2: CRITICAL - Refresh PostgREST schema cache
-- ============================================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Step 3: Verify table created
-- ============================================================================

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'business_programme_profiles'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT 
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'business_programme_profiles';

-- ============================================================================
-- READY TO TEST
-- ============================================================================
-- After running this, go back to Brand Profile page and click "Generate"
-- The Edge Function should now be able to save programme profiles
-- ============================================================================
