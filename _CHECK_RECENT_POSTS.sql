-- ============================================================================
-- CHECK RECENT POSTS: Verify Revenue-Driven Day Allocation
-- ============================================================================
-- Purpose: See if newly generated posts follow revenue_drivers preferred days
-- Run AFTER generating a new weekly strategy

-- Test 1: Show posts for next week (Week 25: June 8-14)
SELECT 
  'Week 25 (Jun 8-14): Post Distribution' as test_name,
  scheduled_for::date as post_date,
  TO_CHAR(scheduled_for, 'Dy') as day_name,
  EXTRACT(DOW FROM scheduled_for) as dow,
  title,
  idea_source,
  status
FROM published_posts
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND scheduled_for >= '2026-06-08'::date
  AND scheduled_for < '2026-06-15'::date
  AND status != 'deleted'
ORDER BY scheduled_for;

-- Test 2: Check for revenue driver coverage (Thu + Fri)
SELECT 
  'Revenue Driver Coverage Check' as test_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM published_posts 
    WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
      AND scheduled_for >= '2026-06-08'::date
      AND scheduled_for < '2026-06-15'::date
      AND EXTRACT(DOW FROM scheduled_for) = 4  -- Thursday
      AND status != 'deleted'
  ) THEN '✅ Thursday' ELSE '❌ Thursday missing' END as thursday_check,
  
  CASE WHEN EXISTS (
    SELECT 1 FROM published_posts 
    WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
      AND scheduled_for >= '2026-06-08'::date
      AND scheduled_for < '2026-06-15'::date
      AND EXTRACT(DOW FROM scheduled_for) = 5  -- Friday
      AND status != 'deleted'
  ) THEN '✅ Friday' ELSE '❌ Friday missing' END as friday_check,
  
  CASE WHEN EXISTS (
    SELECT 1 FROM published_posts 
    WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
      AND scheduled_for >= '2026-06-08'::date
      AND scheduled_for < '2026-06-15'::date
      AND EXTRACT(DOW FROM scheduled_for) = 1  -- Monday
      AND status != 'deleted'
  ) THEN '✅ Monday' ELSE '❌ Monday missing' END as monday_check;

-- Test 3: Compare to preferred_day_pattern from revenue_drivers
WITH expected_days AS (
  SELECT 
    jsonb_array_elements_text(
      brand_profile_v5->'revenue_drivers'->'normal_week_strategy'->'preferred_day_pattern'
    ) as day_name
  FROM business_brand_profile
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
),
actual_days AS (
  SELECT DISTINCT
    TO_CHAR(scheduled_for, 'Day') as day_name_full,
    TRIM(TO_CHAR(scheduled_for, 'Day')) as day_name
  FROM published_posts
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
    AND scheduled_for >= '2026-06-08'::date
    AND scheduled_for < '2026-06-15'::date
    AND status != 'deleted'
)
SELECT 
  'Preferred Day Pattern Compliance' as test_name,
  e.day_name as expected_day,
  CASE 
    WHEN a.day_name IS NOT NULL THEN '✅ Matched'
    ELSE '❌ Not used'
  END as status
FROM expected_days e
LEFT JOIN actual_days a ON LOWER(e.day_name) = LOWER(a.day_name)
ORDER BY 
  CASE LOWER(e.day_name)
    WHEN 'monday' THEN 1
    WHEN 'tuesday' THEN 2
    WHEN 'wednesday' THEN 3
    WHEN 'thursday' THEN 4
    WHEN 'friday' THEN 5
    WHEN 'saturday' THEN 6
    WHEN 'sunday' THEN 7
  END;

-- Expected Results:
-- Test 1: Should show 4 posts on Mon/Thu/Fri/Sat (not Mon/Tue/Wed/Sat)
-- Test 2: All checks should be ✅
-- Test 3: Monday/Thursday/Friday/Saturday should all show ✅ Matched
