-- =====================================================
-- ADD STRATEGIC BRIEF STORAGE TO weekly_strategies
-- =====================================================
-- Stores Phase 1 strategic brief for debugging and analytics.
-- This captures WHY the AI chose specific strategic angles
-- and detailed reasoning that connects brand + menu + context.
--
-- Benefits:
-- - Debug Phase 1 strategic thinking quality
-- - Analyze successful vs weak angle reasoning over time
-- - Build ML datasets from high-performing strategies
-- - Search/filter strategies by angle keywords
-- =====================================================

-- Step 1: Add strategic_brief column (Phase 1 output)
ALTER TABLE public.weekly_strategies
ADD COLUMN IF NOT EXISTS strategic_brief JSONB;

COMMENT ON COLUMN public.weekly_strategies.strategic_brief IS 
'Phase 1 strategic brief output: {week_summary, competitive_advantage, angles: [{focus, weight, reasoning, menu_alignment, content_direction}]}. 
Shows AI strategic thinking before Phase 2 tactical execution.';

-- Step 2: Add raw output for debugging (optional but valuable)
ALTER TABLE public.weekly_strategies
ADD COLUMN IF NOT EXISTS strategic_brief_raw TEXT;

COMMENT ON COLUMN public.weekly_strategies.strategic_brief_raw IS 
'Raw Gemini Phase 1 output before JSON parsing. Useful for debugging prompt/model issues.';

-- Step 3: Add strategy version tracking
ALTER TABLE public.weekly_strategies
ADD COLUMN IF NOT EXISTS strategy_version TEXT DEFAULT 'v2_two_phase';

COMMENT ON COLUMN public.weekly_strategies.strategy_version IS 
'Strategy generation version/architecture. Used to separate analytics across major changes.
- v1_single_phase: Original single-pass generation
- v2_two_phase: Current architecture (Phase 1 strategic brief → Phase 2 content plan)
- v2.1_brand_v5: V5 brand profile integration
Future versions can be added as architecture evolves.';

-- Step 4: GIN index for strategic brief search/analytics
-- Enables fast searching by angle focus, keywords in reasoning, etc.
CREATE INDEX IF NOT EXISTS idx_weekly_strategies_strategic_brief_gin
ON public.weekly_strategies
USING GIN (strategic_brief);

-- Step 5: Index for version-based filtering
CREATE INDEX IF NOT EXISTS idx_weekly_strategies_version
ON public.weekly_strategies(business_id, strategy_version);

-- Verify columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default,
  col_description('public.weekly_strategies'::regclass, ordinal_position) as description
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'weekly_strategies'
  AND column_name IN ('strategic_brief', 'strategic_brief_raw', 'strategy_version')
ORDER BY column_name;

-- =====================================================
-- EXAMPLE QUERIES (for debugging and analytics)
-- =====================================================

-- Find strategies with specific angle focus
-- SELECT business_id, week_start, 
--        strategic_brief->'angles'->0->>'focus' as primary_angle,
--        strategic_brief->'angles'->0->>'reasoning' as reasoning
-- FROM weekly_strategies
-- WHERE strategic_brief @> '{"angles": [{"focus": "Vinterens Hyggelige Anker ved Åen"}]}'::jsonb;

-- Analyze angle quality by version
-- SELECT 
--   strategy_version,
--   COUNT(*) as strategy_count,
--   AVG(jsonb_array_length(strategic_brief->'angles')) as avg_angles_per_strategy
-- FROM weekly_strategies
-- WHERE strategic_brief IS NOT NULL
-- GROUP BY strategy_version;

-- Find strategies mentioning specific brand elements in reasoning
-- SELECT business_id, week_start,
--        strategic_brief->'angles'->0->>'focus' as angle,
--        strategic_brief->'angles'->0->>'reasoning' as reasoning
-- FROM weekly_strategies
-- WHERE strategic_brief->'angles'->0->>'reasoning' ILIKE '%ved åen%'
--    OR strategic_brief->'competitive_advantage' ILIKE '%ved åen%';
