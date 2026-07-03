-- Root Cause Analysis: Missing C Slot
-- weekly_strategies = 2c724599-1a6f-4e46-9d92-f62c8e2fe443
-- business_id = 1a285371-64f7-4def-b248-2e8cdfbba106

-- Step 1: Check the weekly_strategies record
SELECT 
  id,
  business_id,
  week_number,
  year,
  weekly_theme,
  created_at
FROM weekly_strategies
WHERE id = '2c724599-1a6f-4e46-9d92-f62c8e2fe443';

-- Step 2: Check all weekly_plan_days for this strategy
SELECT 
  id,
  strategy_id,
  slot_label,
  post_date,
  post_idea,
  caption
FROM weekly_plan_days
WHERE strategy_id = '2c724599-1a6f-4e46-9d92-f62c8e2fe443'
ORDER BY slot_label;

-- Step 3: Count slots by label
SELECT 
  slot_label,
  COUNT(*) as count
FROM weekly_plan_days
WHERE strategy_id = '2c724599-1a6f-4e46-9d92-f62c8e2fe443'
GROUP BY slot_label
ORDER BY slot_label;

-- Step 4: Check if there are any orphaned ideas that should have been C
SELECT 
  id,
  strategy_id,
  slot_label,
  post_date,
  LEFT(post_idea, 100) as idea_snippet
FROM weekly_plan_days
WHERE strategy_id = '2c724599-1a6f-4e46-9d92-f62c8e2fe443'
ORDER BY post_date;
