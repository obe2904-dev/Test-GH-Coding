-- =====================================================
-- FIX MISSING COLUMNS - ROUND 2
-- =====================================================
-- Two more columns referenced by code but never deployed:
-- 1. weekly_strategies.strategy_rationale
-- 2. contextual_calendar.commercial_weight
-- =====================================================

-- =====================================================
-- 1. ADD strategy_rationale TO weekly_strategies
-- =====================================================
-- From migration: 20260310000000_add_strategy_rationale_column.sql

ALTER TABLE weekly_strategies
  ADD COLUMN IF NOT EXISTS strategy_rationale TEXT;

COMMENT ON COLUMN weekly_strategies.strategy_rationale IS
  'Weekly modulation rationale from strategy-modulator.ts. '
  '1-2 sentences in Danish explaining why this week goal_blend / '
  'content_category_weights deviate from the brand baseline. '
  'NULL or contains "Ingen markante" when baseline was used unchanged.';

-- =====================================================
-- 2. ADD commercial_weight TO contextual_calendar
-- =====================================================
-- From migration: 20260328000001_calendar_commercial_weight_and_occasions.sql

ALTER TABLE contextual_calendar
  ADD COLUMN IF NOT EXISTS commercial_weight SMALLINT NOT NULL DEFAULT 2
    CHECK (commercial_weight BETWEEN 1 AND 10);

ALTER TABLE contextual_calendar
  ADD COLUMN IF NOT EXISTS lead_days SMALLINT NOT NULL DEFAULT 3;

COMMENT ON COLUMN contextual_calendar.commercial_weight IS
  '1=minor, 2-3=low, 4-6=moderate, 7-8=high, 9-10=critical. Controls how aggressively Phase 1 allocates post capacity to this event.';
  
COMMENT ON COLUMN contextual_calendar.lead_days IS
  'Recommended days before event to start posting lead-up content. 0 = day-of only.';

-- Backfill commercial_weight for existing Danish holidays
UPDATE contextual_calendar SET commercial_weight = 9, lead_days = 7
WHERE country = 'DK' AND event_name IN (
  '1. Påskedag', '2. Påskedag'
);

UPDATE contextual_calendar SET commercial_weight = 7, lead_days = 5
WHERE country = 'DK' AND event_name IN (
  'Skærtorsdag', 'Langfredag', 'Kristi Himmelfartsdag', '2. Pinsedag'
);

UPDATE contextual_calendar SET commercial_weight = 5, lead_days = 3
WHERE country = 'DK' AND event_name IN (
  'Nytårsdag', 'Grundlovsdag'
);

UPDATE contextual_calendar SET commercial_weight = 6, lead_days = 7
WHERE country = 'DK' AND event_name = 'Sommerferie';

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'weekly_strategies.strategy_rationale' as fix, 
  CASE WHEN COUNT(*) > 0 THEN '✅ Column added' ELSE '❌ Failed' END as status
FROM information_schema.columns 
WHERE table_name = 'weekly_strategies' AND column_name = 'strategy_rationale'
UNION ALL
SELECT 'contextual_calendar.commercial_weight', 
  CASE WHEN COUNT(*) > 0 THEN '✅ Column added' ELSE '❌ Failed' END
FROM information_schema.columns 
WHERE table_name = 'contextual_calendar' AND column_name = 'commercial_weight'
UNION ALL
SELECT 'contextual_calendar.lead_days', 
  CASE WHEN COUNT(*) > 0 THEN '✅ Column added' ELSE '❌ Failed' END
FROM information_schema.columns 
WHERE table_name = 'contextual_calendar' AND column_name = 'lead_days';
