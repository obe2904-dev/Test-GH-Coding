-- ============================================================================
-- VERIFICATION QUERY: Check if daily_suggestions INSERT fix worked
-- ============================================================================
-- Run this AFTER regenerating Week 19 for Cafe Faust
-- https://supabase.com/dashboard/project/zzauefccejjkdguuyapl/sql
-- ============================================================================

-- 1. Check if posts were inserted into daily_suggestions
SELECT 
  'VERIFICATION: daily_suggestions posts' as check_type,
  COUNT(*) as total_posts,
  COUNT(DISTINCT date) as unique_dates,
  MIN(date) as first_date,
  MAX(date) as last_date,
  COUNT(*) FILTER (WHERE validation_result IS NOT NULL) as posts_with_validation,
  COUNT(*) FILTER (WHERE inferred_content_type IS NOT NULL) as posts_with_content_type
FROM daily_suggestions
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
  AND date >= '2026-05-04'
  AND date <= '2026-05-10';

-- 2. Show the actual posts
SELECT 
  'POST DETAILS' as section,
  id,
  title,
  content_type,
  inferred_content_type,
  date,
  suggested_time,
  position,
  validation_result ->> 'valid' as validation_valid,
  validation_result ->> 'auto_fix_applied' as auto_fix_applied,
  created_at
FROM daily_suggestions
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
  AND date >= '2026-05-04'
  AND date <= '2026-05-10'
ORDER BY date, position;

-- 3. Verify validation_result structure
SELECT 
  'VALIDATION STRUCTURE' as section,
  title,
  date,
  validation_result
FROM daily_suggestions
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
  AND date >= '2026-05-04'
  AND validation_result IS NOT NULL
LIMIT 5;

-- 4. Check strategy status
SELECT 
  'STRATEGY STATUS' as section,
  id,
  status,
  week_number,
  created_at,
  ARRAY_LENGTH(post_ideas::jsonb, 1) as idea_count
FROM weekly_strategies
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
  AND week_number = 19
ORDER BY created_at DESC
LIMIT 1;

-- 5. Check weekly_content_plans
SELECT 
  'WEEKLY PLAN' as section,
  id,
  strategy_id,
  week_number,
  jsonb_array_length(posts::jsonb) as posts_count,
  created_at
FROM weekly_content_plans
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
  AND week_number = 19
ORDER BY created_at DESC
LIMIT 1;

-- ============================================================================
-- EXPECTED RESULTS after successful fix:
-- ============================================================================
-- Query 1: Should show 4 posts, all with validation_result and inferred_content_type
-- Query 2: Should show 4 posts with titles like:
--   - "Mors Dag: Frokostpause" (atmosphere, general)
--   - "Aperol Spritz — dinner" (menu_item, dinner)
--   - "Parisian Chop Steak" (menu_item, dinner)
--   - "Morgenstund ved vandet" (seasonal, general)
-- Query 3: Should show validation_result JSON with {valid: true, violations: []}
-- Query 4: Should show status = 'posts_created'
-- Query 5: Should show matching strategy_id and 4 posts in JSON
-- ============================================================================
