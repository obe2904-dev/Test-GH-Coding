-- ============================================================================
-- CHECK WHERE "Ingen baseline" MESSAGE IS STORED
-- ============================================================================
-- Business ID: f4679fa9-3120-4a59-9506-d059b010c34a
-- Week 2026-06-22 strategy shows NO fallback message in strategic_brief
-- Question: Is the message in weekly_content_plans instead?
-- ============================================================================

-- 1. Check weekly_content_plans for week 2026-06-22
SELECT 
  week_start,
  generated_at,
  summary,
  jsonb_pretty(summary) as summary_formatted
FROM weekly_content_plans
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND week_start = '2026-06-22'
ORDER BY generated_at DESC
LIMIT 1;

-- 2. Search for "Ingen baseline" in ALL fields of weekly_content_plans
SELECT 
  week_start,
  generated_at,
  CASE 
    WHEN summary::text LIKE '%Ingen baseline%' THEN 'Found in summary'
    WHEN posts::text LIKE '%Ingen baseline%' THEN 'Found in posts'
    WHEN learning_data::text LIKE '%Ingen baseline%' THEN 'Found in learning_data'
    ELSE 'Not found'
  END as location_of_message
FROM weekly_content_plans
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY generated_at DESC
LIMIT 5;

-- 3. Check if there are MULTIPLE plans for week 2026-06-22
SELECT 
  week_start,
  generated_at,
  CASE 
    WHEN generated_at < '2026-06-15 12:45:21.507812+00' THEN '❌ OLD (before fix)'
    ELSE '✅ NEW (after fix)'
  END as timing,
  LEFT(summary::text, 200) as summary_preview
FROM weekly_content_plans
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND week_start = '2026-06-22'
ORDER BY generated_at DESC;

-- 4. What week are you ACTUALLY viewing in the UI?
-- Check the most recent plan that was generated
SELECT 
  week_start,
  generated_at,
  'This is the most recent plan' as note
FROM weekly_content_plans
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY generated_at DESC
LIMIT 1;

-- ============================================================================
-- DIAGNOSIS:
-- ============================================================================
-- The weekly_strategies record for 2026-06-22 does NOT contain the fallback message.
-- This suggests:
-- 1. The message is stored in weekly_content_plans, not weekly_strategies
-- 2. OR you're viewing a different week in the UI than 2026-06-22
-- 3. OR the UI is calculating the message based on missing data
-- 
-- Check query #3 to see if there are OLD and NEW plans for the same week.
-- ============================================================================
