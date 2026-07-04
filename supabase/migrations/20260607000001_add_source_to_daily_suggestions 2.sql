-- =====================================================
-- Migration: Add source column to daily_suggestions
-- Date: 2026-06-07
-- 
-- Enables Weekly Plan and Quick Suggestions to coexist
-- without overwriting each other's ideas.
--
-- Problem: Both systems write to daily_suggestions with
-- UNIQUE(business_id, suggestion_date, position), causing
-- Quick Suggestions to overwrite Weekly Plan data.
--
-- Solution: Add source column and update unique constraint
-- to UNIQUE(business_id, suggestion_date, position, source)
-- =====================================================

-- ── 1. Add source column ──────────────────────────────
-- Track whether idea came from Weekly Plan or Quick Suggestions
ALTER TABLE daily_suggestions 
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'quick_suggestions'
    CHECK (source IN ('quick_suggestions', 'weekly_plan'));

COMMENT ON COLUMN daily_suggestions.source IS 
  'Origin system: quick_suggestions (AI Ideas for today) or weekly_plan (strategic week planning). Allows both systems to coexist without overwrites.';

-- ── 2. Backfill existing data ─────────────────────────
-- Set all existing suggestions to 'quick_suggestions' (they are from that system)
UPDATE daily_suggestions 
SET source = 'quick_suggestions' 
WHERE source IS NULL;

-- Now make it NOT NULL since we've backfilled
ALTER TABLE daily_suggestions 
  ALTER COLUMN source SET NOT NULL;

-- ── 3. Drop old unique constraint ─────────────────────
-- First, check if the constraint exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'daily_suggestions_business_id_date_position_key'
  ) THEN
    ALTER TABLE daily_suggestions 
      DROP CONSTRAINT daily_suggestions_business_id_date_position_key;
    RAISE NOTICE '✅ Dropped old unique constraint';
  ELSE
    RAISE NOTICE 'ℹ️  Old constraint not found (may have different name)';
  END IF;
END $$;

-- ── 4. Add new unique constraint ──────────────────────
-- Allow both systems to have ideas for the same day/position
ALTER TABLE daily_suggestions
  ADD CONSTRAINT daily_suggestions_business_date_position_source_key 
  UNIQUE(business_id, date, position, source);

COMMENT ON CONSTRAINT daily_suggestions_business_date_position_source_key ON daily_suggestions IS
  'Allows Weekly Plan and Quick Suggestions to coexist: same business can have 3 suggestions from each system per day.';

-- ── 5. Create performance index ───────────────────────
-- Fast lookups by business + source + date
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_source
  ON daily_suggestions(business_id, source, date);

COMMENT ON INDEX idx_daily_suggestions_source IS
  'Performance index for querying suggestions by system source (weekly_plan vs quick_suggestions)';

-- ── 6. Verify migration ───────────────────────────────
DO $$
DECLARE
  source_count INTEGER;
  constraint_exists BOOLEAN;
BEGIN
  -- Check source column exists and has data
  SELECT COUNT(*) INTO source_count
  FROM daily_suggestions
  WHERE source IS NOT NULL;
  
  IF source_count > 0 THEN
    RAISE NOTICE '✅ Source column populated: % rows', source_count;
  ELSE
    RAISE WARNING '⚠️  No data in daily_suggestions yet (expected for new installs)';
  END IF;
  
  -- Check new constraint exists
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'daily_suggestions_business_date_position_source_key'
  ) INTO constraint_exists;
  
  IF constraint_exists THEN
    RAISE NOTICE '✅ New unique constraint created successfully';
  ELSE
    RAISE WARNING '⚠️  New constraint not found!';
  END IF;
END $$;

-- ── 7. Display updated schema ─────────────────────────
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'daily_suggestions'
  AND column_name IN ('source', 'business_id', 'date', 'position')
ORDER BY ordinal_position;
