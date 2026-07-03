-- ============================================================================
-- ANALYZE: Check post day allocation from weekly_strategies
-- ============================================================================
-- Purpose: Extract suggested_day from post_ideas to see if revenue drivers worked

SELECT 
  'Post Day Allocation Analysis' as test_name,
  post_idea->>'suggested_day' as suggested_day,
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

-- Expected Revenue Driver Pattern: Monday (1), Thursday (4), Friday (5), Saturday (6)
-- Old Calendar Pattern: Thursday (4), Friday (5), Saturday (6), Sunday (0)

-- Check if revenue drivers pattern is present
SELECT 
  'Revenue Driver Coverage Check' as test_name,
  CASE WHEN bool_and(dow = ANY(ARRAY[1,4,5,6])) THEN '✅ Revenue pattern (Mon/Thu/Fri/Sat)' 
       WHEN bool_and(dow = ANY(ARRAY[4,5,6,0])) THEN '❌ Old calendar pattern (Thu/Fri/Sat/Sun)'
       ELSE '⚠️ Mixed pattern'
  END as pattern_detected,
  STRING_AGG(DISTINCT TO_CHAR((post_idea->>'suggested_day')::date, 'Dy'), ', ' ORDER BY TO_CHAR((post_idea->>'suggested_day')::date, 'Dy')) as days_used
FROM weekly_strategies,
  jsonb_array_elements(post_ideas) as post_idea,
  LATERAL (SELECT EXTRACT(DOW FROM (post_idea->>'suggested_day')::date) as dow) d
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND week_start = '2026-06-15'::date;
