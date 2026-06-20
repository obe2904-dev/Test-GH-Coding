-- ============================================================================
-- VERIFY WEEKLY PLAN GENERATION TIMESTAMP vs CONTENT_STRATEGY FIX
-- ============================================================================
-- Business ID: f4679fa9-3120-4a59-9506-d059b010c34a
-- Content Strategy Fixed At: 2026-06-15 12:45:21.507812+00
-- Question: Was the weekly plan generated BEFORE or AFTER the fix?
-- ============================================================================

-- 1. Show content_strategy update time
SELECT 
  'content_strategy_fixed_at' as event,
  updated_at as timestamp,
  content_strategy->>'source' as source
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. Show ALL weekly content plans with their generation times
SELECT 
  'weekly_plan_generated_at' as event,
  week_start,
  generated_at as timestamp,
  CASE 
    WHEN generated_at < '2026-06-15 12:45:21.507812+00' THEN '❌ BEFORE fix (old plan)'
    WHEN generated_at > '2026-06-15 12:45:21.507812+00' THEN '✅ AFTER fix (should have correct data)'
    ELSE '⚠️  EXACTLY at fix time'
  END as timing_vs_fix,
  LEFT(summary::text, 100) as summary_preview
FROM weekly_content_plans
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY generated_at DESC
LIMIT 10;

-- 3. Check if there are multiple plans for the same week
SELECT 
  week_start,
  COUNT(*) as plan_count,
  MAX(generated_at) as latest_generation,
  ARRAY_AGG(generated_at ORDER BY generated_at DESC) as all_generation_times
FROM weekly_content_plans
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
GROUP BY week_start
HAVING COUNT(*) > 1
ORDER BY week_start DESC;

-- 4. Show the ACTUAL strategic rationale stored in the most recent plan
SELECT 
  week_start,
  generated_at,
  posts->0->'metadata'->>'strategic_rationale' as first_post_strategic_rationale,
  summary
FROM weekly_content_plans
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY generated_at DESC
LIMIT 1;

-- 5. Check weekly_strategies table (the NEW architecture)
SELECT 
  'strategy_generated_at' as event,
  week_start,
  generated_at as timestamp,
  CASE 
    WHEN generated_at < '2026-06-15 12:45:21.507812+00' THEN '❌ BEFORE fix'
    WHEN generated_at > '2026-06-15 12:45:21.507812+00' THEN '✅ AFTER fix'
    ELSE '⚠️  AT fix time'
  END as timing_vs_fix,
  strategic_brief->'week_strategic_rationale' as strategic_rationale
FROM weekly_strategies
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY generated_at DESC
LIMIT 5;

-- ============================================================================
-- INTERPRETATION GUIDE:
-- ============================================================================
-- Look at the timestamps in the results:
--
-- IF most recent weekly plan shows "❌ BEFORE fix":
--   → You're viewing an OLD plan that was generated before content_strategy was fixed
--   → Solution: Delete old plans and generate a NEW one, OR generate for next week
--   → Command: DELETE FROM weekly_content_plans WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
--
-- IF most recent weekly plan shows "✅ AFTER fix":
--   → The plan was generated with correct data
--   → But the strategic_rationale field still shows fallback message
--   → This means there's a deeper issue in the code
--   → Check query #4 to see what strategic_rationale is actually stored
--
-- IF there are multiple plans for the same week:
--   → The UI might be showing an older plan instead of the latest
--   → Clean up duplicates
-- ============================================================================
