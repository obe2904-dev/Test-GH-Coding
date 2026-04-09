-- =====================================================
-- PHASE 1 TEST: Quick Verification
-- =====================================================
-- Run this in Supabase SQL Editor after generating a new weekly plan
--
-- Business: Café Faust (840347de-9ba7-4275-8aa3-4553417fc2af)
-- =====================================================

-- STEP 1: Check latest plan age
SELECT 
    'Latest Plan' as check_type,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago,
    week_start,
    (SELECT COUNT(*) FROM jsonb_array_elements(posts)) as post_count
FROM weekly_content_plans
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY created_at DESC
LIMIT 1;

-- STEP 2: Bug #3 - Check if scores are varied (not all 70)
WITH score_summary AS (
  SELECT 
    (p->'opportunity'->>'finalScore')::int as score,
    COUNT(*) as posts_with_score
  FROM weekly_content_plans,
       jsonb_array_elements(posts) as p
  WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
    AND created_at = (SELECT MAX(created_at) FROM weekly_content_plans WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af')
  GROUP BY (p->'opportunity'->>'finalScore')::int
)
SELECT 
    'Bug #3: Scoring' as test,
    score,
    posts_with_score,
    CASE 
        WHEN (SELECT COUNT(DISTINCT score) FROM score_summary) = 1 AND score = 70 
        THEN '❌ NOT FIXED - All scores are 70'
        WHEN (SELECT COUNT(DISTINCT score) FROM score_summary) = 1
        THEN '⚠️ PARTIALLY FIXED - All same score but not 70'
        ELSE '✅ FIXED - Scores are varied'
    END as status
FROM score_summary
ORDER BY score DESC;

-- STEP 3: Bug #4 - Check for time collisions
SELECT 
    'Bug #4: Collisions' as test,
    p->'timing'->>'day' as day,
    p->'timing'->>'time' as time,
    COUNT(*) as posts_at_slot,
    CASE 
        WHEN COUNT(*) > 1 THEN '❌ COLLISION DETECTED'
        ELSE '✅ No collision'
    END as status,
    json_agg(p->'contentSubject'->>'dish') as subjects
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND created_at = (SELECT MAX(created_at) FROM weekly_content_plans WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af')
GROUP BY p->'timing'->>'day', p->'timing'->>'time'
ORDER BY p->'timing'->>'day', p->'timing'->>'time';

-- STEP 4: Detailed score breakdown (if Bug #3 is fixed)
SELECT 
    p->'contentSubject'->>'dish' as subject,
    (p->'opportunity'->>'finalScore')::int as total,
    (p->'opportunity'->'scoreBreakdown'->>'baseScore')::int as base,
    (p->'opportunity'->'scoreBreakdown'->>'seasonalBonus')::int as seasonal,
    (p->'opportunity'->'scoreBreakdown'->>'weatherBonus')::int as weather,
    (p->'opportunity'->'scoreBreakdown'->>'locationBonus')::int as location,
    p->'opportunity'->>'selectionReason' as reason
FROM weekly_content_plans,
     jsonb_array_elements(posts) as p
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND created_at = (SELECT MAX(created_at) FROM weekly_content_plans WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af')
ORDER BY (p->'opportunity'->>'finalScore')::int DESC;

-- =====================================================
-- EXPECTED RESULTS:
-- =====================================================
-- STEP 1: Should show plan created in last few minutes
-- 
-- STEP 2 (Bug #3): 
--   ✅ FIXED: Multiple rows with different scores (e.g., 145, 87, 65, 52)
--   ❌ NOT FIXED: Single row showing score = 70
--
-- STEP 3 (Bug #4):
--   ✅ FIXED: All rows show posts_at_slot = 1, status = '✅ No collision'
--   ❌ NOT FIXED: Some rows show posts_at_slot > 1, status = '❌ COLLISION DETECTED'
--
-- STEP 4: Shows varied breakdown values across different menu items
-- =====================================================
