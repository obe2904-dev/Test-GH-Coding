-- ═══════════════════════════════════════════════════════════════════════════
-- Create business_photo_analysis Table
-- ═══════════════════════════════════════════════════════════════════════════
-- Date: May 9, 2026
-- Purpose: Separate photo analysis data from brand profile
--          Visual character, interior identity, and venue scene should not be
--          mixed with strategic brand profile data.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create photo analysis table
CREATE TABLE IF NOT EXISTS business_photo_analysis (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Visual character (concept label for tone calibration)
  -- Example: "Casual moderne café", "Elegant fine-dining", "Rustik landlig"
  visual_character TEXT,
  
  -- Interior description (factual venue anchor for atmosphere posts)
  -- Example: "Lyse lokaler med træborde, grønne planter, store vinduer mod gaden"
  interior_identity TEXT,
  
  -- Atmospheric qualities (sensory/perceptual layer)
  -- Example: "Blød eftermiddagslys, lav rumstøj, hyggelig intimitet"
  venue_scene TEXT,
  
  -- Metadata
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  analysis_confidence NUMERIC(3,2) CHECK (analysis_confidence >= 0 AND analysis_confidence <= 1),
  photo_sources TEXT[], -- URLs or references to source photos
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_photo_analysis_confidence 
  ON business_photo_analysis (analysis_confidence DESC);

CREATE INDEX IF NOT EXISTS idx_photo_analysis_analyzed_at 
  ON business_photo_analysis (analyzed_at DESC);

-- 3. Add comments
COMMENT ON TABLE business_photo_analysis IS 
  'Photo analysis data separated from brand profile. Used for tone calibration in atmosphere posts.
   
   This data is intentionally NOT part of brand_profile_v5 because:
   - It comes from visual analysis, not strategic planning
   - It updates independently from brand strategy
   - It''s used for tone calibration, not core identity
   
   Used by: get-weekly-strategy (visual_profile context), atmosphere post prompts';

COMMENT ON COLUMN business_photo_analysis.visual_character IS 
  'Concept label for tone register calibration (e.g., "Casual moderne café")';

COMMENT ON COLUMN business_photo_analysis.interior_identity IS 
  'Factual venue description from photo analysis - prevents AI hallucination in atmosphere posts';

COMMENT ON COLUMN business_photo_analysis.venue_scene IS 
  'Sensory/atmospheric qualities: light, material, spatial density - for atmosphere post enhancement';

-- 4. Migrate existing data from business_brand_profile
INSERT INTO business_photo_analysis (
  business_id,
  visual_character,
  interior_identity,
  venue_scene,
  analyzed_at,
  analysis_confidence
)
SELECT 
  bbp.business_id,
  bbp.visual_character,
  bbp.recognizable_interior_identity,
  bbp.venue_scene,
  COALESCE(bbp.brand_profile_v5_generated_at, bbp.updated_at, NOW()),
  0.75 -- Default confidence for migrated data
FROM business_brand_profile bbp
WHERE 
  bbp.visual_character IS NOT NULL OR
  bbp.recognizable_interior_identity IS NOT NULL OR
  bbp.venue_scene IS NOT NULL
ON CONFLICT (business_id) DO UPDATE SET
  visual_character = EXCLUDED.visual_character,
  interior_identity = EXCLUDED.interior_identity,
  venue_scene = EXCLUDED.venue_scene,
  analyzed_at = EXCLUDED.analyzed_at,
  analysis_confidence = EXCLUDED.analysis_confidence,
  updated_at = NOW();

-- 5. Verify migration
SELECT 
  COUNT(*) as migrated_count,
  COUNT(*) FILTER (WHERE visual_character IS NOT NULL) as has_visual_character,
  COUNT(*) FILTER (WHERE interior_identity IS NOT NULL) as has_interior_identity,
  COUNT(*) FILTER (WHERE venue_scene IS NOT NULL) as has_venue_scene,
  ROUND(AVG(analysis_confidence)::numeric, 2) as avg_confidence
FROM business_photo_analysis;

-- 6. Create view for easy access
CREATE OR REPLACE VIEW photo_analysis_summary AS
SELECT 
  bpa.business_id,
  b.name as business_name,
  bpa.visual_character,
  LEFT(bpa.interior_identity, 100) as interior_preview,
  LEFT(bpa.venue_scene, 100) as scene_preview,
  bpa.analysis_confidence,
  bpa.analyzed_at,
  CASE 
    WHEN bpa.visual_character IS NULL AND bpa.interior_identity IS NULL AND bpa.venue_scene IS NULL THEN 'Empty'
    WHEN bpa.visual_character IS NOT NULL AND bpa.interior_identity IS NOT NULL AND bpa.venue_scene IS NOT NULL THEN 'Complete'
    ELSE 'Partial'
  END as completeness_status
FROM business_photo_analysis bpa
LEFT JOIN businesses b ON bpa.business_id = b.id;

COMMENT ON VIEW photo_analysis_summary IS 
  'Summary view of photo analysis data for all businesses';
