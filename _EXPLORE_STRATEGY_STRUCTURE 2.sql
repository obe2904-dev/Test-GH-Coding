-- ============================================================================
-- EXPLORE ACTUAL STRUCTURE OF weekly_strategies
-- ============================================================================
-- Business ID: f4679fa9-3120-4a59-9506-d059b010c34a
-- Issue: strategic_rationale is NULL - need to find where the text is stored
-- ============================================================================

-- 1. Get the FULL structure of the most recent strategy (generated AFTER fix)
SELECT 
  week_start,
  generated_at,
  jsonb_pretty(
    jsonb_build_object(
      'id', id,
      'week_start', week_start,
      'generated_at', generated_at,
      'status', status,
      'narrative', narrative,
      'strategic_priorities', strategic_priorities,
      'strategic_brief', strategic_brief,
      'post_ideas', post_ideas
    )
  ) as full_record
FROM weekly_strategies
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND week_start = '2026-06-22'  -- The one generated AFTER the fix
LIMIT 1;

-- 2. Check what columns exist in weekly_strategies table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'weekly_strategies'
ORDER BY ordinal_position;

-- 3. Get just the strategic_brief field to see its structure
SELECT 
  week_start,
  generated_at,
  jsonb_pretty(strategic_brief) as strategic_brief_structure
FROM weekly_strategies
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND week_start = '2026-06-22'
LIMIT 1;

-- 4. Search for the text "Ingen baseline" anywhere in the record
SELECT 
  week_start,
  CASE 
    WHEN narrative::text LIKE '%Ingen baseline%' THEN 'Found in narrative'
    WHEN strategic_brief::text LIKE '%Ingen baseline%' THEN 'Found in strategic_brief'
    WHEN strategic_priorities::text LIKE '%Ingen baseline%' THEN 'Found in strategic_priorities'
    WHEN post_ideas::text LIKE '%Ingen baseline%' THEN 'Found in post_ideas'
    ELSE 'Not found in any field'
  END as location_of_text
FROM weekly_strategies
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY generated_at DESC
LIMIT 5;

-- 5. Check all columns in the most recent strategy
SELECT 
  week_start,
  generated_at,
  id,
  status,
  narrative,
  strategic_priorities,
  strategic_brief,
  week_context_snapshot
FROM weekly_strategies
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND week_start = '2026-06-22'
LIMIT 1;

-- ============================================================================
-- GOAL:
-- Find where "Ingen baseline content strategy fundet" message is stored
-- or where "Baseline-strategi: 57% bookinger..." should appear
-- ============================================================================
