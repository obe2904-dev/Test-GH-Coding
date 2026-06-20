-- ============================================================================
-- CHECK WEEKLY STRATEGY vs BRAND PROFILE content_strategy
-- ============================================================================
-- Business ID: f4679fa9-3120-4a59-9506-d059b010c34a
-- Goal: See if weekly_strategies are using old content_strategy or new one
-- ============================================================================

-- 1. Check current business_brand_profile.content_strategy
SELECT 
  'BRAND PROFILE' as source,
  business_id,
  content_strategy,
  content_strategy->'goal_blend' as goal_blend,
  content_strategy->'goal_blend'->>'drive_footfall' as drive_footfall,
  content_strategy->'goal_blend'->>'build_brand' as build_brand,
  content_strategy->'goal_blend'->>'retain_loyalty' as retain_loyalty
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. Check all weekly_strategies for this business
SELECT 
  'WEEKLY STRATEGY' as source,
  business_id,
  week_start,
  week_number,
  generated_at,
  status,
  strategy_rationale,
  (week_context_snapshot->'brand_voice'->'content_strategy') as snapshot_content_strategy,
  (week_context_snapshot->'brand_voice'->'content_strategy'->'goal_blend') as snapshot_goal_blend
FROM weekly_strategies
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY week_start DESC
LIMIT 5;

-- 3. Check if any strategies have the fallback message
SELECT 
  week_start,
  week_number,
  generated_at,
  strategy_rationale,
  CASE 
    WHEN strategy_rationale LIKE '%Ingen baseline content strategy fundet%' THEN '❌ HAS FALLBACK MESSAGE'
    ELSE '✅ No fallback'
  END as status
FROM weekly_strategies
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY week_start DESC
LIMIT 5;

-- ============================================================================
-- EXPECTED RESULTS:
-- ============================================================================
-- Query 1 (BRAND PROFILE): Should show goal_blend with 57/27/17 split
-- Query 2 (WEEKLY STRATEGY): Should show snapshot_goal_blend for each week
-- Query 3: Weeks generated AFTER content_strategy fix should not have fallback
--
-- If Query 3 shows fallback for recently generated weeks, then either:
-- 1. content_strategy in brand_profile is still null/missing goal_blend
-- 2. The week was generated before the fix and needs regeneration
-- ============================================================================
