-- =====================================================
-- ADD PLANNER_RATIONALE COLUMN TO daily_suggestions
-- =====================================================
-- Stores the timing/strategic rationale shown in the UI
-- Prevents mismatch between cached slot times and fresh rationales
-- =====================================================

ALTER TABLE daily_suggestions
ADD COLUMN IF NOT EXISTS planner_rationale TEXT;

COMMENT ON COLUMN public.daily_suggestions.planner_rationale IS 
  'Strategic timing context for this suggestion set (e.g., "Lørdag eftermiddag — gæster planlægger aftenens valg")';

-- Verify column was added
SELECT 
  'Success! planner_rationale column added' AS message,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'daily_suggestions'
  AND column_name = 'planner_rationale';
