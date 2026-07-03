-- Migration: Separate Demographic Proximity from Geographic Location Types
-- Date: 2026-05-22
-- Purpose: Add demographic_proximity field to separate WHO (demographics) from WHERE (geography)

-- STEP 1: Add new column for demographic proximity
ALTER TABLE business_location_intelligence
  ADD COLUMN IF NOT EXISTS demographic_proximity JSONB DEFAULT '{}'::jsonb;

-- STEP 2: Add version tracking column
ALTER TABLE business_location_intelligence
  ADD COLUMN IF NOT EXISTS location_architecture_version INT DEFAULT 1;

-- STEP 3: Add comments
COMMENT ON COLUMN business_location_intelligence.demographic_proximity IS 
  'Demographic population density scores (0-100): university_proximity, tourist_flow, office_worker_density, residential_density. Used as context for programme segment generation, not displayed as location types.';

COMMENT ON COLUMN business_location_intelligence.location_architecture_version IS 
  'Architecture version: 1 = old (student/tourist in category_scores), 2 = new (demographics separated)';

-- STEP 4: Create index for demographic proximity queries
CREATE INDEX IF NOT EXISTS idx_location_demographic_proximity 
  ON business_location_intelligence USING GIN (demographic_proximity);

-- STEP 5: Verify columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_location_intelligence' 
    AND column_name = 'demographic_proximity'
  ) THEN
    RAISE EXCEPTION 'Failed to create demographic_proximity column';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_location_intelligence' 
    AND column_name = 'location_architecture_version'
  ) THEN
    RAISE EXCEPTION 'Failed to create location_architecture_version column';
  END IF;
  
  RAISE NOTICE 'Migration 20260522000001 completed successfully';
END $$;
