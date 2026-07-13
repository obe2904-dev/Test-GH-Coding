-- ═══════════════════════════════════════════════════════════════════════════
-- Migrate Photo Analysis Data from business_brand_profile
-- ═══════════════════════════════════════════════════════════════════════════
-- Date: May 9, 2026
-- Purpose: Copy visual_character, recognizable_interior_identity, venue_scene
--          from business_brand_profile to business_photo_analysis table
--
-- Run this AFTER creating business_photo_analysis table
-- ═══════════════════════════════════════════════════════════════════════════

-- Migrate existing data from business_brand_profile
-- Note: business_brand_profile has 'business_id' as primary key (references businesses.id)
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

-- Verify migration
SELECT 
  COUNT(*) as migrated_count,
  COUNT(*) FILTER (WHERE visual_character IS NOT NULL) as has_visual_character,
  COUNT(*) FILTER (WHERE interior_identity IS NOT NULL) as has_interior_identity,
  COUNT(*) FILTER (WHERE venue_scene IS NOT NULL) as has_venue_scene,
  ROUND(AVG(analysis_confidence)::numeric, 2) as avg_confidence
FROM business_photo_analysis;

-- Show sample migrated data
SELECT 
  b.name,
  LEFT(bpa.visual_character, 50) as visual_character,
  LEFT(bpa.interior_identity, 50) as interior_identity,
  LEFT(bpa.venue_scene, 50) as venue_scene
FROM business_photo_analysis bpa
LEFT JOIN businesses b ON bpa.business_id = b.id
LIMIT 10;
