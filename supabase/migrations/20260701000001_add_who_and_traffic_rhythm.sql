-- Migration: Add WHO and TRAFFIC_RHYTHM fields for Physical Anchor Taxonomy v3
-- Date: 2026-07-01
-- Purpose: Replace demographic_proximity with richer who/traffic_rhythm structure

-- STEP 1: Add WHO column (replaces demographic_proximity with semantic richness)
ALTER TABLE business_location_intelligence
  ADD COLUMN IF NOT EXISTS who JSONB DEFAULT NULL;

-- STEP 2: Add TRAFFIC_RHYTHM column (time-aware location facts)
ALTER TABLE business_location_intelligence
  ADD COLUMN IF NOT EXISTS traffic_rhythm JSONB DEFAULT NULL;

-- STEP 3: Update schema version to 3
ALTER TABLE business_location_intelligence
  ALTER COLUMN location_architecture_version SET DEFAULT 3;

-- STEP 4: Add indexes for new JSONB columns
CREATE INDEX IF NOT EXISTS idx_location_who 
  ON business_location_intelligence USING GIN (who);

CREATE INDEX IF NOT EXISTS idx_location_traffic_rhythm 
  ON business_location_intelligence USING GIN (traffic_rhythm);

-- STEP 5: Add column comments
COMMENT ON COLUMN business_location_intelligence.who IS 
  'WHO is physically in this area. Structure: {primary: WhoType[], secondary: WhoType[], notes?: string}. Valid WhoType: local_resident, office_worker, student, shopper, tourist, commuter, leisure_walker, family, medical_staff, hospital_visitor, event_visitor.';

COMMENT ON COLUMN business_location_intelligence.traffic_rhythm IS 
  'WHEN does this location generate traffic. Structure: {peak_days, peak_hours, dead_periods, seasonal_pattern, seasonal_note?}. Used for time-aware content strategy.';

-- STEP 6: Update architecture version comment
COMMENT ON COLUMN business_location_intelligence.location_architecture_version IS 
  'Architecture version: 1 = old (student/tourist in category_scores), 2 = demographics in demographic_proximity, 3 = who + traffic_rhythm (Physical Anchor Taxonomy v3)';

-- STEP 7: Verify migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_location_intelligence' 
    AND column_name = 'who'
  ) THEN
    RAISE EXCEPTION 'Failed to create who column';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_location_intelligence' 
    AND column_name = 'traffic_rhythm'
  ) THEN
    RAISE EXCEPTION 'Failed to create traffic_rhythm column';
  END IF;
  
  RAISE NOTICE 'Migration 20260701000001 completed successfully - Physical Anchor Taxonomy v3 schema ready';
END $$;
