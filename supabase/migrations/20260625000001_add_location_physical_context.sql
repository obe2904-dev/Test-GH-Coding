-- Migration: Add physical_context and raw_competitive_venues to Location Intelligence
-- Date: 2026-06-25
-- Purpose: Refactor location intelligence to pure geography layer (Phase 1: Additive)

-- Add physical_context column for objective physical environment facts
ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS physical_context JSONB;

-- Add raw_competitive_venues for uninterpreted competitor data
ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS raw_competitive_venues JSONB;

-- Add comment explaining the architecture
COMMENT ON COLUMN business_location_intelligence.physical_context IS 
'Objective physical environment facts: pedestrian_flow, transit_within_150m, nearest_transit, parking_within_300m, street_level. Used by Brand Profile for strategy generation.';

COMMENT ON COLUMN business_location_intelligence.raw_competitive_venues IS 
'Raw competitor venue data from Google Places (no AI interpretation). Array of: {name, distance_meters, rating, user_ratings_total, price_level, place_id, types}. Used by Brand Profile for competitive positioning.';

-- Verify columns exist
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'business_location_intelligence'
  AND column_name IN ('physical_context', 'raw_competitive_venues')
ORDER BY column_name;
