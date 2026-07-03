-- Create business_programme_profiles table
-- Stores programme-level brand profile data (Layers 1, 2, 4)
-- Complements business_brand_profile (Layers 3, 5 - business-level data)

CREATE TABLE IF NOT EXISTS business_programme_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  programme_type text NOT NULL,
  
  -- LAYER 1: Programme Detection (deterministic)
  programme_name text NOT NULL, -- e.g., 'Brunch', 'Frokost', 'Aftensmad'
  time_windows text[] NOT NULL DEFAULT '{}', -- ["Lør-Søn 09:00-14:00", "17:00-22:00"]
  operating_days text[] NOT NULL DEFAULT '{}', -- ['Lør', 'Søn', 'Man', ...]
  menu_evidence text[] NOT NULL DEFAULT '{}', -- ['eggs benedict', 'pasta', ...]
  confidence numeric, -- 0.0-1.0 detection confidence
  
  -- LAYER 2: Commercial Orientation (AI-generated per programme)
  baseline_goal_split jsonb, -- { "drive_footfall": 40, "strengthen_brand": 40, "retain_regulars": 20 }
  decision_timing text, -- 'spontaneous', 'planned', 'mixed'
  content_type_affinity jsonb, -- { "product_menu": 0.8, "behind_scenes": 0.4, "atmosphere": 0.7, "community": 0.5, "educational": 0.2 }
  
  -- LAYER 4: Audience Segmentation (AI-generated per programme)
  audience_segments jsonb, -- Array of segments: [{label, timing_windows, content_angles, segment_size, motivation, decision_timing, goal_contribution, evidence}]
  segment_confidence numeric, -- 0.0-1.0 segment generation confidence
  segment_reasoning text, -- Why AI chose these segments
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version_hash text, -- Change detection for regeneration
  generation_errors jsonb, -- Error log from last generation
  
  -- Constraints
  UNIQUE(business_id, programme_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_programme_profiles_business_id 
  ON business_programme_profiles(business_id);

CREATE INDEX IF NOT EXISTS idx_business_programme_profiles_programme_type 
  ON business_programme_profiles(programme_type);

CREATE INDEX IF NOT EXISTS idx_business_programme_profiles_updated_at 
  ON business_programme_profiles(updated_at DESC);

-- RLS policies (copy from businesses table pattern)
ALTER TABLE business_programme_profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own programme profiles
CREATE POLICY "Users can view their own programme profiles"
  ON business_programme_profiles
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Allow authenticated users to insert/update their own programme profiles
CREATE POLICY "Users can manage their own programme profiles"
  ON business_programme_profiles
  FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_business_programme_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_business_programme_profiles_updated_at
  BEFORE UPDATE ON business_programme_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_business_programme_profiles_updated_at();

-- Comments for documentation
COMMENT ON TABLE business_programme_profiles IS 'Programme-level brand profile data (Layers 1, 2, 4). Complements business_brand_profile which stores business-level data (Layers 3, 5).';
COMMENT ON COLUMN business_programme_profiles.programme_type IS 'Type of dining programme (e.g., brunch, lunch, dinner)';
COMMENT ON COLUMN business_programme_profiles.time_windows IS 'Operating hours for this programme as text array, e.g., ["Lør-Søn 09:00-14:00"]';
COMMENT ON COLUMN business_programme_profiles.menu_evidence IS 'Menu items that prove this programme exists, e.g., ["eggs benedict", "pasta"]';
COMMENT ON COLUMN business_programme_profiles.confidence IS 'Layer 1 detection confidence (0.0-1.0)';
COMMENT ON COLUMN business_programme_profiles.baseline_goal_split IS 'Layer 2: Commercial strategy baseline - % split between drive_footfall, strengthen_brand, retain_regulars (must sum to 100)';
COMMENT ON COLUMN business_programme_profiles.content_type_affinity IS 'Layer 2: Content type weights as 0.0-1.0 scores (product_menu, behind_scenes, atmosphere, community, educational)';
COMMENT ON COLUMN business_programme_profiles.decision_timing IS 'Layer 2: Customer decision pattern - spontaneous, planned, or mixed';
COMMENT ON COLUMN business_programme_profiles.audience_segments IS 'Layer 4: Array of audience segments specific to this programme with evidence';
COMMENT ON COLUMN business_programme_profiles.segment_confidence IS 'Layer 4: Segment generation confidence (0.0-1.0)';
COMMENT ON COLUMN business_programme_profiles.segment_reasoning IS 'Layer 4: AI explanation of why these segments were chosen';
