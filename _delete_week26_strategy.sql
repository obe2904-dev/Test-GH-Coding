-- Delete the cached week 26 strategy and plan to force fresh generation
-- Must delete content_plan first due to foreign key constraint

-- Step 1: Delete content plan
DELETE FROM weekly_content_plans
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND week_number = 26;

-- Step 2: Delete strategy
DELETE FROM weekly_strategies
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND week_number = 26;

-- Verify deletion
SELECT 
  (SELECT COUNT(*) FROM weekly_strategies WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79' AND week_number = 26) as strategies_remaining,
  (SELECT COUNT(*) FROM weekly_content_plans WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79' AND week_number = 26) as plans_remaining;
