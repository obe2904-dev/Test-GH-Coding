-- ============================================================================
-- ADD ALL MISSING EDGE FUNCTION COLUMNS TO BUSINESS_LOCATION_INTELLIGENCE
-- ============================================================================
-- The populate-location-intelligence Edge Function expects these columns
-- This is causing PGRST204 errors when the Edge Function tries to save
-- ============================================================================

-- Add nearby_hospitality column (competitive density within 300m)
ALTER TABLE business_location_intelligence 
  ADD COLUMN IF NOT EXISTS nearby_hospitality JSONB DEFAULT '{
    "radius_meters": 300,
    "total_count": 0,
    "breakdown": {"restaurant": 0, "cafe": 0, "bar": 0},
    "density_label": "low",
    "fetched_at": null
  }'::jsonb;

-- Add WHO/WHEN/WHY analysis columns (public versions - no competitor names)
ALTER TABLE business_location_intelligence 
  ADD COLUMN IF NOT EXISTS who_analysis JSONB;

ALTER TABLE business_location_intelligence 
  ADD COLUMN IF NOT EXISTS when_analysis JSONB;

ALTER TABLE business_location_intelligence 
  ADD COLUMN IF NOT EXISTS why_analysis JSONB;

-- Add WHO/WHEN/WHY internal analysis columns (with competitor names for AI use)
ALTER TABLE business_location_intelligence 
  ADD COLUMN IF NOT EXISTS who_analysis_internal JSONB;

ALTER TABLE business_location_intelligence 
  ADD COLUMN IF NOT EXISTS when_analysis_internal JSONB;

ALTER TABLE business_location_intelligence 
  ADD COLUMN IF NOT EXISTS why_analysis_internal JSONB;

-- Add local_location_reference column (authentic local place names like "ved åen", "bugten", etc.)
ALTER TABLE business_location_intelligence 
  ADD COLUMN IF NOT EXISTS local_location_reference TEXT;

-- Refresh PostgREST schema cache so it recognizes ALL new columns
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show all columns after adding
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_location_intelligence'
ORDER BY ordinal_position;

-- Confirm ALL new columns exist
SELECT 
  -- Client-side columns
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'category_scores') as category_scores_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'location_type_matches') as location_type_matches_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'concept_fit_by_category') as concept_fit_by_category_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'concept_fit_analyzed_at') as concept_fit_analyzed_at_exists,
  -- Edge Function columns
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'nearby_hospitality') as nearby_hospitality_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'who_analysis') as who_analysis_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'when_analysis') as when_analysis_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'why_analysis') as why_analysis_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'who_analysis_internal') as who_analysis_internal_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'when_analysis_internal') as when_analysis_internal_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'why_analysis_internal') as why_analysis_internal_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'local_location_reference') as local_location_reference_exists;
