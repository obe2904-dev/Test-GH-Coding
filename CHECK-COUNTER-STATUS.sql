-- =====================================================
-- CHECK COUNTER STATUS - 17. maj 2026
-- =====================================================
-- Run this in Supabase Dashboard to check if counter is resetting

-- ── 1. Check raw counter value in businesses table ──
SELECT 
  quick_suggestions_today AS "Counter Value",
  last_quick_suggestions_reset AS "Last Reset Date",
  CURRENT_DATE AS "Today's Date",
  plan AS "Plan",
  CASE 
    WHEN last_quick_suggestions_reset < CURRENT_DATE THEN '❌ NOT RESET (should be 0)'
    WHEN last_quick_suggestions_reset = CURRENT_DATE THEN '✅ Already reset today'
    ELSE '❓ Unknown state'
  END AS "Status"
FROM businesses 
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ── 2. Check what get_daily_usage_stats returns ──
SELECT 
  regenerations_used AS "Regenerations Used",
  regenerations_limit AS "Regenerations Limit",
  suggestions_count AS "Suggestions Count",
  tier AS "Tier"
FROM get_daily_usage_stats('f4679fa9-3120-4a59-9506-d059b010c34a');

-- ── 3. Check today's suggestions ──
SELECT 
  COUNT(*) AS "Number of suggestions for today",
  date AS "Date"
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND date = CURRENT_DATE
GROUP BY date;
