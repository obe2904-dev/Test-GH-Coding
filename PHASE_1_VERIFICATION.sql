-- =====================================================
-- PHASE 1 VERIFICATION: Bug #3 and #4 Fixes
-- =====================================================
-- Bug #3: Scoring should vary (not all 70)
-- Bug #4: No time collisions
-- Test Business: Café Faust (840347de-9ba7-4275-8aa3-4553417fc2af)

-- =====================================================
-- Q1: Check latest plan creation time
-- =====================================================
SELECT 
    created_at,
    week_start_date,
    (SELECT COUNT(*) FROM jsonb_array_elements(posts)) as total_posts
FROM weekly_content_plans
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY created_at DESC
LIMIT 1;

-- =====================================================
-- Q2: Check scores are now varied (Bug #3 fix)
-- =====================================================
-- EXPECTED: Scores should range from 50-250+, NOT all 70
SELECT 
    p->'contentSubject'->>'dish' as subject,
    (p->'opportunity'->>'finalScore')::int as final_score,
    p->'opportunity'->'scoreBreakdown'->>'baseScore' as base_score,
    p->'opportunity'->'scoreBreakdown'->>'seasonalBonus' as seasonal_bonus,
    p->'opportunity'->'scoreBreakdown'->>'weatherBonus' as weather_bonus,
    p->'opportunity'->>'selectionReason' as reason
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND created_at = (
    SELECT MAX(created_at) 
    FROM weekly_content_plans 
    WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  )
ORDER BY (p->'opportunity'->>'finalScore')::int DESC;

-- =====================================================
-- Q3: Check score distribution (not all same value)
-- =====================================================
SELECT 
    (p->'opportunity'->>'finalScore')::int as score,
    COUNT(*) as count_with_score,
    json_agg(p->'contentSubject'->>'dish') as subjects
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND created_at = (
    SELECT MAX(created_at) 
    FROM weekly_content_plans 
    WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  )
GROUP BY (p->'opportunity'->>'finalScore')::int
ORDER BY score DESC;

-- =====================================================
-- Q4: Check for time collisions (Bug #4 fix)
-- =====================================================
-- EXPECTED: Each (day, time) combo should appear only once
SELECT 
    p->'timing'->>'day' as day,
    p->'timing'->>'time' as time,
    COUNT(*) as posts_at_this_slot,
    json_agg(p->'contentSubject'->>'dish') as subjects
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND created_at = (
    SELECT MAX(created_at) 
    FROM weekly_content_plans 
    WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  )
GROUP BY p->'timing'->>'day', p->'timing'->>'time'
HAVING COUNT(*) > 1;

-- =====================================================
-- Q5: Show complete schedule with scores
-- =====================================================
SELECT 
    p->'timing'->>'day' as day,
    p->'timing'->>'time' as time,
    p->'contentSubject'->>'dish' as subject,
    p->'postType'->>'type' as type,
    (p->'opportunity'->>'finalScore')::int as score,
    p->'timing'->>'timeRationale' as time_reason
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND created_at = (
    SELECT MAX(created_at) 
    FROM weekly_content_plans 
    WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  )
ORDER BY p->'timing'->>'day', p->'timing'->>'time';

-- =====================================================
-- Q6: Verify collision resolution notes (if any)
-- =====================================================
SELECT 
    p->'timing'->>'day' as day,
    p->'timing'->>'time' as time,
    p->'contentSubject'->>'dish' as subject,
    p->'timing'->>'timeRationale' as rationale
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND created_at = (
    SELECT MAX(created_at) 
    FROM weekly_content_plans 
    WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  )
  AND p->'timing'->>'timeRationale' LIKE '%collision%'
ORDER BY p->'timing'->>'day', p->'timing'->>'time';

-- =====================================================
-- VERIFICATION CRITERIA
-- =====================================================
-- ✅ PASS if:
-- Q2: Scores vary (not all 70)
-- Q3: Multiple different score values exist
-- Q4: Returns 0 rows (no collisions)
-- Q5: All posts have unique (day, time) combinations
-- Q6: Shows collision notes if rescheduling occurred
--
-- ❌ FAIL if:
-- Q2: All scores are 70
-- Q3: Only one score value (70)
-- Q4: Returns rows (collisions exist)
-- Q5: Duplicate (day, time) pairs
