-- =====================================================
-- VERIFY STRATEGIC BRIEF STORAGE
-- =====================================================
-- Run these queries to confirm the new columns exist
-- and strategic_brief is being saved properly.
-- =====================================================

-- Step 1: Verify columns were added
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

-- Step 2: Verify indexes were created
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'weekly_strategies'
  AND (indexname LIKE '%strategic_brief%' OR indexname LIKE '%version%')
ORDER BY indexname;

-- Step 3: Check existing strategies (should have NULL for new columns)
SELECT 
  business_id,
  week_start,
  strategy_version,
  strategic_brief IS NOT NULL as has_strategic_brief,
  strategic_brief_raw IS NOT NULL as has_raw_output,
  jsonb_array_length(strategic_brief->'angles') as angle_count,
  created_at
FROM weekly_strategies
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY week_start DESC
LIMIT 5;

-- Step 4: After generating NEW strategy, run this to inspect it
-- (Replace week_start with today's or next week's date)
/*
SELECT 
  business_id,
  week_start,
  week_number,
  strategy_version,
  
  -- Check strategic_brief exists
  strategic_brief IS NOT NULL as has_strategic_brief,
  
  -- Extract week summary
  strategic_brief->>'week_summary' as week_summary,
  
  -- Extract competitive advantage
  strategic_brief->>'competitive_advantage' as competitive_advantage,
  
  -- Get angle count
  jsonb_array_length(strategic_brief->'angles') as angle_count,
  
  -- Extract first angle details
  strategic_brief->'angles'->0->>'focus' as angle_1_focus,
  strategic_brief->'angles'->0->'weight' as angle_1_weight,
  LEFT(strategic_brief->'angles'->0->>'reasoning', 100) as angle_1_reasoning_preview,
  LEFT(strategic_brief->'angles'->0->>'menu_alignment', 80) as angle_1_menu_alignment_preview,
  
  -- Check raw output (first 200 chars)
  LEFT(strategic_brief_raw, 200) as raw_output_preview,
  
  -- Timestamp
  created_at
FROM weekly_strategies
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND week_start >= CURRENT_DATE
ORDER BY week_start DESC
LIMIT 1;
*/

-- Step 5: Search by angle focus (example - test after generating new strategy)
/*
SELECT 
  business_id,
  week_start,
  strategic_brief->'angles'->0->>'focus' as primary_angle,
  strategic_brief->'angles'->1->>'focus' as secondary_angle,
  strategic_brief->>'competitive_advantage' as competitive_advantage
FROM weekly_strategies
WHERE strategic_brief @> '{"angles": [{"focus": "Vinterens Hyggelige Anker ved Åen"}]}'::jsonb
ORDER BY week_start DESC;
*/

-- Step 6: Analyze strategic brief quality by version
/*
SELECT 
  strategy_version,
  COUNT(*) as strategy_count,
  COUNT(CASE WHEN strategic_brief IS NOT NULL THEN 1 END) as has_brief_count,
  AVG(jsonb_array_length(strategic_brief->'angles')) as avg_angles_per_strategy,
  AVG(LENGTH(strategic_brief->>'week_summary')) as avg_summary_length
FROM weekly_strategies
GROUP BY strategy_version
ORDER BY strategy_version DESC;
*/

-- Step 7: Find strategies mentioning brand elements in reasoning
/*
SELECT 
  business_id,
  week_start,
  strategic_brief->'angles'->0->>'focus' as angle,
  strategic_brief->'competitive_advantage' as competitive_advantage
FROM weekly_strategies
WHERE strategic_brief->'angles'->0->>'reasoning' ILIKE '%ved åen%'
   OR strategic_brief->'angles'->0->>'reasoning' ILIKE '%waterfront%'
   OR strategic_brief->>'competitive_advantage' ILIKE '%åen%'
ORDER BY week_start DESC;
*/
