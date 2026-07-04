-- ============================================================================
-- CHECK WEEKLY PLAN GENERATION TIMESTAMP
-- ============================================================================
-- Business ID: f4679fa9-3120-4a59-9506-d059b010c34a
-- Issue: UI shows old fallback message even after content_strategy fix
-- ============================================================================

-- 1. Check when content_strategy was updated
SELECT 
  'content_strategy update time' as check_type,
  updated_at
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Result should be: 2026-06-15 12:45:21.507812+00

-- 2. Check ALL weekly plan records and their generation times
SELECT 
  week_start,
  generated_at,
  summary,
  (posts->0->>'strategic_rationale') as first_post_rationale,
  status
FROM weekly_content_plans
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY week_start DESC
LIMIT 5;

-- Look for week_strategic_rationale in the summary or posts

-- 3. Check weekly_strategies table (if it exists)
SELECT 
  week_start,
  generated_at,
  strategic_brief,
  status
FROM weekly_strategies
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY week_start DESC
LIMIT 5;

-- 4. Check if there's a week_strategic_rationale field anywhere
SELECT 
  week_start,
  generated_at,
  jsonb_pretty(posts) as posts_preview
FROM weekly_content_plans
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY generated_at DESC
LIMIT 1;

-- ============================================================================
-- DIAGNOSIS:
-- ============================================================================
-- If the most recent weekly plan has generated_at BEFORE 12:45:21:
--   → You're viewing an OLD plan generated before the fix
--   → Solution: Generate a BRAND NEW weekly plan (not regenerate the same week)
--
-- If the most recent weekly plan has generated_at AFTER 12:45:21:
--   → The plan was generated with correct data
--   → The message might be cached in the UI
--   → Solution: Hard refresh browser (Cmd+Shift+R)
-- ============================================================================
