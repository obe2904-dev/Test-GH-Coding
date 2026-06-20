-- ============================================================================
-- FIX: Force regeneration of weekly strategies with fallback message
-- ============================================================================
-- Business ID: f4679fa9-3120-4a59-9506-d059b010c34a
-- 
-- PROBLEM: UI shows "Ingen baseline content strategy fundet" even after
--          fixing content_strategy in business_brand_profile
--
-- CAUSE: The strategy_rationale is stored in weekly_strategies table.
--        Old strategies generated BEFORE content_strategy fix still have
--        the fallback message saved.
--
-- SOLUTION: Delete strategies with fallback message to force regeneration
-- ============================================================================

-- STEP 1: Check which weeks have the fallback message
SELECT 
  week_start,
  week_number,
  generated_at,
  status,
  strategy_rationale
FROM weekly_strategies
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND strategy_rationale LIKE '%Ingen baseline content strategy fundet%'
ORDER BY week_start DESC;

-- STEP 2: Delete strategies with fallback (they will regenerate automatically)
-- IMPORTANT: Only run this AFTER verifying content_strategy exists in brand_profile!
/*
DELETE FROM weekly_strategies
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND strategy_rationale LIKE '%Ingen baseline content strategy fundet%';
*/

-- STEP 3: Verify deletion
-- Should return 0 rows after deletion
/*
SELECT COUNT(*) as strategies_with_fallback
FROM weekly_strategies
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND strategy_rationale LIKE '%Ingen baseline content strategy fundet%';
*/

-- ============================================================================
-- ALTERNATIVE: Delete specific week only
-- ============================================================================
-- If you only want to regenerate current/next week (not all old weeks):
/*
DELETE FROM weekly_strategies
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND week_start >= '2026-06-15'  -- Adjust date as needed
  AND strategy_rationale LIKE '%Ingen baseline content strategy fundet%';
*/

-- ============================================================================
-- After deletion, refresh the UI - the week will regenerate automatically
-- with the correct content_strategy from business_brand_profile
-- ============================================================================
