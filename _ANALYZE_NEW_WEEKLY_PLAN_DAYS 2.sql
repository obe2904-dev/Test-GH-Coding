-- ============================================================================
-- ANALYZE: Post day allocation from NEW weekly plan (after Stage RD integration)
-- ============================================================================
-- Purpose: Verify revenue-driven day allocation is working

SELECT 
  'Post Day Allocation Analysis (Week 25 - June 15-21)' as test_name,
  post_idea->>'suggested_day' as suggested_day,
  TO_CHAR((post_idea->>'suggested_day')::date, 'Day') as day_name_full,
  TO_CHAR((post_idea->>'suggested_day')::date, 'Dy') as day_name,
  EXTRACT(DOW FROM (post_idea->>'suggested_day')::date) as dow,
  post_idea->>'title' as post_title,
  post_idea->>'slot_id' as slot,
  post_idea->>'goal_mode' as goal_mode,
  post_idea->>'angle_focus' as angle
FROM weekly_strategies,
  jsonb_array_elements(post_ideas) as post_idea
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND week_start = '2026-06-15'::date
ORDER BY (post_idea->>'suggested_day')::date;

-- Check if revenue drivers pattern is present
SELECT 
  'Revenue Driver Coverage Check (NEW)' as test_name,
  CASE 
    WHEN bool_and(dow = ANY(ARRAY[1,4,5,6])) THEN '✅ Revenue pattern (Mon/Thu/Fri/Sat)' 
    WHEN bool_and(dow = ANY(ARRAY[4,5,6,0])) THEN '❌ Old calendar pattern (Thu/Fri/Sat/Sun)'
    WHEN bool_and(dow = ANY(ARRAY[0,1,3,4])) THEN '⚠️ Mixed: Mon/Wed/Thu/Sun'
    ELSE '⚠️ Other pattern'
  END as pattern_detected,
  STRING_AGG(DISTINCT TO_CHAR((post_idea->>'suggested_day')::date, 'Dy'), ', ' ORDER BY TO_CHAR((post_idea->>'suggested_day')::date, 'Dy')) as days_used,
  STRING_AGG(DISTINCT EXTRACT(DOW FROM (post_idea->>'suggested_day')::date)::text, ', ' ORDER BY EXTRACT(DOW FROM (post_idea->>'suggested_day')::date)) as dow_used,
  COUNT(*) as total_posts
FROM weekly_strategies,
  jsonb_array_elements(post_ideas) as post_idea,
  LATERAL (SELECT EXTRACT(DOW FROM (post_idea->>'suggested_day')::date) as dow) d
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND week_start = '2026-06-15'::date;

-- Compare with revenue drivers
SELECT 
  'Revenue Drivers vs Actual Posts' as test_name,
  brand_profile_v5->'revenue_drivers'->'preferred_day_pattern' as preferred_days_from_revenue_drivers,
  (
    SELECT STRING_AGG(DISTINCT TO_CHAR((post_idea->>'suggested_day')::date, 'Day'), ', ' ORDER BY TO_CHAR((post_idea->>'suggested_day')::date, 'Day'))
    FROM weekly_strategies ws2,
      jsonb_array_elements(ws2.post_ideas) as post_idea
    WHERE ws2.business_id = bp.business_id
      AND ws2.week_start = '2026-06-15'::date
  ) as actual_days_used
FROM business_brand_profile bp
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
