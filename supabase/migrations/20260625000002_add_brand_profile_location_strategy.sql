-- Migration: Add location_strategy and generation_status to Brand Profile
-- Date: 2026-06-25
-- Purpose: Support Phase 2 - Brand Profile consumes location intelligence

-- Add location_strategy column for crossed location × business strategy
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS location_strategy JSONB;

-- Add generation_status column for graceful degradation
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS generation_status JSONB;

-- Add data_sources_used column to track what data was available
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS data_sources_used JSONB;

-- Add comments
COMMENT ON COLUMN business_brand_profile.location_strategy IS 
'Crossed location intelligence (geography + demographics) × business facts (pricing, booking, programmes) → reachable_demographics, positioning_angles, content_triggers, competitive_gap. Generated in Brand Profile Layer 0.';

COMMENT ON COLUMN business_brand_profile.generation_status IS 
'Generation status flags for graceful degradation: menu_status, location_status, brand_profile_status, missing_components, fallback_mode, warnings. Used by UI to highlight incomplete data.';

COMMENT ON COLUMN business_brand_profile.data_sources_used IS 
'Tracks which data sources were available during generation: menu_data, location_intelligence, business_profile, operations. Used for debugging and quality monitoring.';

-- Verify columns exist
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'business_brand_profile'
  AND column_name IN ('location_strategy', 'generation_status', 'data_sources_used')
ORDER BY column_name;
