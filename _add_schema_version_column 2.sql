-- Migration: Add schema_version column to business_location_intelligence
-- Date: 2026-06-26
-- Purpose: Track schema version for location intelligence data (v1 vs v2)
--          v1: student/tourist in category_scores
--          v2: category_scores = geographic only, demographic_proximity = separate field

ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS schema_version INTEGER DEFAULT 1;

-- Set existing records to version 1 (old schema)
UPDATE business_location_intelligence
SET schema_version = 1
WHERE schema_version IS NULL;

-- Add comment
COMMENT ON COLUMN business_location_intelligence.schema_version IS 
  'Schema version: 1=legacy (student/tourist in category_scores), 2=split (category_scores=geographic, demographic_proximity=separate)';
