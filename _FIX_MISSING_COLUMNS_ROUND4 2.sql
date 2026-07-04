-- =====================================================
-- FIX MISSING COLUMNS - ROUND 4
-- =====================================================
-- From migration: 20260212000000_add_strategic_brief_storage.sql
-- Missing: strategic_brief, strategic_brief_raw
-- =====================================================

-- Add strategic_brief column (Phase 1 output - JSONB)
ALTER TABLE weekly_strategies
  ADD COLUMN IF NOT EXISTS strategic_brief JSONB;

COMMENT ON COLUMN weekly_strategies.strategic_brief IS 
  'Phase 1 strategic analysis output: angles, competitive advantage, content types, week summary. Used by Phase 2/3 for post generation.';

-- Add strategic_brief_raw column (raw AI response for debugging)
ALTER TABLE weekly_strategies
  ADD COLUMN IF NOT EXISTS strategic_brief_raw TEXT;

COMMENT ON COLUMN weekly_strategies.strategic_brief_raw IS 
  'Raw AI response text before JSON parsing (for debugging and quality monitoring).';

-- Add GIN index for JSONB queries on strategic_brief
CREATE INDEX IF NOT EXISTS idx_weekly_strategies_strategic_brief_gin
  ON weekly_strategies
  USING GIN (strategic_brief);

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 
  CASE WHEN COUNT(*) = 2 THEN '✅ Both columns added' ELSE '❌ Failed' END as status
FROM information_schema.columns 
WHERE table_name = 'weekly_strategies' 
  AND column_name IN ('strategic_brief', 'strategic_brief_raw');
