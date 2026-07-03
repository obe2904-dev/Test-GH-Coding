-- ============================================================================
-- TEST SUITE: Weekly Plan Business Rules Engine
-- ============================================================================
-- Purpose: Validate that revenue_drivers schema drives day allocation correctly
-- Run AFTER: _SCHEMA_revenue_drivers.sql migration applied
-- Expected: Posts follow business-first logic (not calendar templates)

-- ============================================================================
-- Test 1: Verify revenue_drivers exists and is populated
-- ============================================================================
-- Expected: Cafe Faust has revenue_drivers with primary/secondary/tertiary + normal_week_strategy
SELECT 
  'Test 1: Revenue Drivers Schema' as test_name,
  business_id,
  brand_profile_v5->'revenue_drivers'->'primary'->>'moment' as primary_driver,
  brand_profile_v5->'revenue_drivers'->'primary'->'post_timing'->'recommended_posts'->0->>'day' as primary_day,
  brand_profile_v5->'revenue_drivers'->'secondary'->'post_timing'->'recommended_posts'->0->>'day' as secondary_day,
  brand_profile_v5->'revenue_drivers'->'normal_week_strategy'->>'preferred_day_pattern' as preferred_days,
  CASE 
    WHEN brand_profile_v5->'revenue_drivers' IS NOT NULL THEN '✅ Schema populated'
    ELSE '❌ Missing revenue_drivers'
  END as status
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- Test 2: Check recent Weekly Plan posts - Normal Week (Week 23)
-- ============================================================================
-- Expected: Posts on Mon/Thu/Fri/Sat (revenue_drivers.normal_week_strategy.preferred_day_pattern)
-- Should NOT be front-loaded (Mon/Tue/Wed/Sat)
WITH week_23_posts AS (
  SELECT 
    scheduled_for,
    TO_CHAR(scheduled_for, 'Dy') as day_name,
    title,
    idea_source
  FROM published_posts
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
    AND scheduled_for >= '2026-06-01'::date
    AND scheduled_for < '2026-06-08'::date
    AND status != 'deleted'
  ORDER BY scheduled_for
)
SELECT 
  'Test 2: Normal Week Day Distribution (Week 23)' as test_name,
  STRING_AGG(day_name, ', ' ORDER BY scheduled_for) as actual_days,
  CASE 
    WHEN STRING_AGG(day_name, ', ' ORDER BY scheduled_for) LIKE '%Thu%' 
         AND STRING_AGG(day_name, ', ' ORDER BY scheduled_for) LIKE '%Fri%' 
    THEN '✅ Revenue driver days present (Thu-Fri)'
    ELSE '❌ Missing revenue driver days'
  END as thu_fri_coverage,
  CASE
    WHEN STRING_AGG(day_name, ', ' ORDER BY scheduled_for) NOT LIKE '%Tue%'
         OR STRING_AGG(day_name, ', ' ORDER BY scheduled_for) NOT LIKE '%Wed%'
    THEN '✅ Not front-loaded'
    ELSE '⚠️ Front-loaded pattern detected'
  END as spread_check
FROM week_23_posts;

-- ============================================================================
-- Test 3: Check Grundlovsdag Week (Week 24, June 5 2026 is Friday)
-- ============================================================================
-- Expected: Day-of post on FRIDAY (June 5) + lead-up posts
-- Old behavior: Posts on Mon/Tue/Wed/Thu but NOT Friday (the actual holiday)
WITH grundlovsdag_week AS (
  SELECT 
    scheduled_for,
    TO_CHAR(scheduled_for, 'Dy DD') as day_label,
    title
  FROM published_posts
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
    AND scheduled_for >= '2026-06-08'::date  -- Week 24 starts June 8 (Monday)
    AND scheduled_for < '2026-06-15'::date
    AND status != 'deleted'
  ORDER BY scheduled_for
)
SELECT 
  'Test 3: Grundlovsdag Week (June 5 Friday)' as test_name,
  STRING_AGG(day_label, ', ' ORDER BY scheduled_for) as post_dates,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM published_posts 
      WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
        AND scheduled_for::date = '2026-06-05'::date  -- Friday, Grundlovsdag
        AND status != 'deleted'
    )
    THEN '✅ Day-of post exists (Friday June 5)'
    ELSE '❌ Missing day-of post on Grundlovsdag Friday'
  END as day_of_coverage
FROM grundlovsdag_week;

-- ============================================================================
-- Test 4: Consecutive Days Guard (No ≥3 consecutive days)
-- ============================================================================
-- Expected: Max 2 consecutive days in any week
WITH recent_weeks AS (
  SELECT 
    DATE_TRUNC('week', scheduled_for) as week_start,
    scheduled_for::date as post_date
  FROM published_posts
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
    AND scheduled_for >= CURRENT_DATE - INTERVAL '14 days'
    AND status != 'deleted'
  ORDER BY scheduled_for
),
consecutive_runs AS (
  SELECT 
    week_start,
    post_date,
    LAG(post_date, 1) OVER (PARTITION BY week_start ORDER BY post_date) as prev_1,
    LAG(post_date, 2) OVER (PARTITION BY week_start ORDER BY post_date) as prev_2,
    CASE 
      WHEN post_date - LAG(post_date, 1) OVER (PARTITION BY week_start ORDER BY post_date) = 1
           AND post_date - LAG(post_date, 2) OVER (PARTITION BY week_start ORDER BY post_date) = 2
      THEN TRUE
      ELSE FALSE
    END as is_three_consecutive
  FROM recent_weeks
)
SELECT 
  'Test 4: Consecutive Days Guard' as test_name,
  COUNT(*) FILTER (WHERE is_three_consecutive = TRUE) as violations,
  CASE 
    WHEN COUNT(*) FILTER (WHERE is_three_consecutive = TRUE) = 0 
    THEN '✅ No ≥3 consecutive days'
    ELSE '❌ ' || COUNT(*) FILTER (WHERE is_three_consecutive = TRUE)::text || ' violations found'
  END as guard_status
FROM consecutive_runs;

-- ============================================================================
-- Test 5: Revenue Driver Day Accuracy (Detailed)
-- ============================================================================
-- Expected: Weekend dinner posts on Thu/Fri, Weekday lunch on Mon/Wed
WITH recent_posts AS (
  SELECT 
    scheduled_for,
    EXTRACT(DOW FROM scheduled_for) as dow,  -- 0=Sun, 1=Mon, 4=Thu, 5=Fri, 6=Sat
    TO_CHAR(scheduled_for, 'Dy') as day_name,
    title,
    idea_source
  FROM published_posts
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
    AND scheduled_for >= CURRENT_DATE - INTERVAL '14 days'
    AND status != 'deleted'
),
dow_distribution AS (
  SELECT 
    day_name,
    COUNT(*) as post_count,
    ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM recent_posts)::numeric * 100, 1) as percentage
  FROM recent_posts
  GROUP BY day_name, dow
  ORDER BY dow
)
SELECT 
  'Test 5: Day of Week Distribution' as test_name,
  STRING_AGG(day_name || ': ' || post_count::text || ' (' || percentage::text || '%)', ', ' ORDER BY day_name) as distribution,
  CASE 
    WHEN EXISTS (SELECT 1 FROM dow_distribution WHERE day_name = 'Thu' AND post_count >= 1)
         AND EXISTS (SELECT 1 FROM dow_distribution WHERE day_name = 'Fri' AND post_count >= 1)
    THEN '✅ Revenue drivers covered (Thu-Fri)'
    ELSE '❌ Missing Thu-Fri revenue driver coverage'
  END as revenue_driver_check
FROM dow_distribution;

-- ============================================================================
-- EXPECTED RESULTS SUMMARY
-- ============================================================================

/*
Test 1: ✅ Schema populated
  - primary_driver: "weekend_dinner"
  - primary_day: "Thursday"
  - secondary_day: "Monday"
  - preferred_days: '["Monday", "Thursday", "Friday", "Saturday"]'

Test 2: ✅ Revenue driver days present (Thu-Fri) + Not front-loaded
  - Actual days should include Thu AND Fri
  - Should NOT be Mon/Tue/Wed/Sat only

Test 3: ✅ Day-of post exists (Friday June 5)
  - Grundlovsdag week must have post ON the holiday (same_day event)

Test 4: ✅ No ≥3 consecutive days
  - Consecutive guard still enforced

Test 5: ✅ Revenue drivers covered (Thu-Fri)
  - Distribution shows Thu and Fri posts exist in last 14 days
*/
