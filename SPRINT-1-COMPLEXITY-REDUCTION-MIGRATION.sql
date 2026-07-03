-- =====================================================================
-- SPRINT 1: COMPLEXITY REDUCTION MIGRATION
-- =====================================================================
-- 
-- PURPOSE:
-- Remove Stage B1 (voice archetypes) and consolidate audience intelligence
-- 
-- CHANGES:
-- 1. Drop voice_options column (JSONB) — ~15s generation time saved
-- 2. Drop voice_archetype column (text) — removes switching UI complexity
-- 3. Drop audience_framework column (JSONB) — duplicates audience_segments
-- 
-- CONSOLIDATION LOGIC:
-- - audience_segments (Stage B5) is KEPT — has actionable data (timing_windows, content_angles)
-- - audience_framework was abstract multi-dimensional representation, unused in content generation
-- - Both solved same problem → picked the one with actionable data
-- 
-- IMPACT:
-- - Before: 77 columns, 6 AI stages (~150s generation)
-- - After: 74 columns, 5 AI stages (~135s generation)
-- - Owner gets ONE voice (opinionated, not optional)
-- - Content generation uses audience_segments directly
-- 
-- ROLLBACK:
-- To restore columns, run:
--   ALTER TABLE business_brand_profile 
--     ADD COLUMN voice_options JSONB,
--     ADD COLUMN voice_archetype TEXT,
--     ADD COLUMN audience_framework JSONB;
-- 
-- DATE: Sprint 1 - Complexity Reduction (Jan 2026)
-- =====================================================================

BEGIN;

-- Drop voice archetype system (Stage B1 removal)
ALTER TABLE business_brand_profile
  DROP COLUMN IF EXISTS voice_options,
  DROP COLUMN IF EXISTS voice_archetype;

-- Drop audience framework (consolidation to audience_segments)
ALTER TABLE business_brand_profile
  DROP COLUMN IF EXISTS audience_framework;

COMMIT;

-- Verification: Count remaining columns
SELECT COUNT(*) AS column_count 
FROM information_schema.columns 
WHERE table_name = 'business_brand_profile'
  AND table_schema = 'public';

-- Expected result: 74 columns (down from 77)
