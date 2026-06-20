-- ============================================================================
-- DIAGNOSE: TWO-STEP WEEKLY PLAN GENERATION
-- ============================================================================
-- Business ID: f4679fa9-3120-4a59-9506-d059b010c34a
-- Content Strategy Fixed At: 2026-06-15 12:45:21.507812+00
--
-- HYPOTHESIS: 
-- Weekly Plan has TWO separate steps:
-- 1. get-weekly-strategy → Creates strategy with strategic_rationale text
-- 2. generate-weekly-plan → Creates posts based on that strategy
--
-- When you click "Regenerate Weekly Plan", it might regenerate the PLAN
-- but NOT the STRATEGY, so it reuses the OLD strategy from before the fix.
-- ============================================================================

-- 1. Check when STRATEGIES were generated
SELECT 
  'STRATEGY' as type,
  id as strategy_id,
  week_start,
  generated_at,
  CASE 
    WHEN generated_at < '2026-06-15 12:45:21.507812+00' THEN '❌ BEFORE content_strategy fix'
    WHEN generated_at > '2026-06-15 12:45:21.507812+00' THEN '✅ AFTER content_strategy fix'
    ELSE '⚠️  EXACTLY at fix time'
  END as timing_vs_fix,
  status,
  strategic_brief->>'week_strategic_rationale' as strategic_rationale_text
FROM weekly_strategies
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY generated_at DESC
LIMIT 5;

-- 2. Check when PLANS were generated and which strategy they use
SELECT 
  'PLAN' as type,
  id as plan_id,
  week_start,
  generated_at,
  CASE 
    WHEN generated_at < '2026-06-15 12:45:21.507812+00' THEN '❌ BEFORE content_strategy fix'
    WHEN generated_at > '2026-06-15 12:45:21.507812+00' THEN '✅ AFTER content_strategy fix'
    ELSE '⚠️  EXACTLY at fix time'
  END as timing_vs_fix,
  -- Try to find strategy_id reference (might be in different places)
  summary->>'strategy_id' as strategy_id_from_summary,
  posts->0->'metadata'->>'strategy_id' as strategy_id_from_post
FROM weekly_content_plans
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY generated_at DESC
LIMIT 5;

-- 3. Join strategies and plans to see the relationship
SELECT 
  s.week_start,
  s.generated_at as strategy_generated_at,
  p.generated_at as plan_generated_at,
  CASE 
    WHEN s.generated_at < '2026-06-15 12:45:21.507812+00' THEN '❌ OLD strategy (before fix)'
    ELSE '✅ NEW strategy (after fix)'
  END as strategy_status,
  CASE 
    WHEN p.generated_at < '2026-06-15 12:45:21.507812+00' THEN '❌ OLD plan (before fix)'
    ELSE '✅ NEW plan (after fix)'
  END as plan_status,
  s.strategic_brief->>'week_strategic_rationale' as strategic_rationale_text,
  LEFT(p.summary::text, 150) as plan_summary_preview
FROM weekly_strategies s
LEFT JOIN weekly_content_plans p ON s.week_start = p.week_start AND s.business_id = p.business_id
WHERE s.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY s.week_start DESC
LIMIT 5;

-- 4. Check for mismatched timestamps (strategy old, plan new)
SELECT 
  s.week_start,
  s.generated_at as strategy_time,
  p.generated_at as plan_time,
  (p.generated_at - s.generated_at) as time_difference,
  CASE 
    WHEN s.generated_at < '2026-06-15 12:45:21.507812+00' 
     AND p.generated_at > '2026-06-15 12:45:21.507812+00' 
    THEN '🔴 MISMATCH: Plan regenerated but using OLD strategy!'
    ELSE '✅ OK'
  END as diagnosis
FROM weekly_strategies s
JOIN weekly_content_plans p ON s.week_start = p.week_start AND s.business_id = p.business_id
WHERE s.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY s.week_start DESC
LIMIT 5;

-- ============================================================================
-- EXPECTED FINDING:
-- ============================================================================
-- Query #4 should show:
-- 
-- week_start  | strategy_time | plan_time | diagnosis
-- ------------|---------------|-----------|----------------------------------
-- 2026-06-XX  | 12:15:17      | 12:50:00  | 🔴 MISMATCH: Plan regenerated but using OLD strategy!
--
-- This confirms that:
-- - The STRATEGY was generated at 12:15 (BEFORE the content_strategy fix at 12:45)
-- - The PLAN was regenerated at 12:50 (AFTER the fix)
-- - But the plan is still using the OLD strategy with the fallback message
--
-- SOLUTION:
-- You need to regenerate the STRATEGY, not just the plan!
-- In the UI, look for a button that says "Regenerate Strategy" or similar
-- OR delete the old strategy and generate a new one
-- ============================================================================

-- 5. Solution: Delete old strategy to force regeneration
-- UNCOMMENT to execute:
-- DELETE FROM weekly_strategies 
-- WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
--   AND week_start = '2026-06-XX'; -- Replace with actual week_start date
