-- =====================================================
-- TEST USAGE TRACKING
-- =====================================================
-- Verify that usage tracking is working correctly

-- ── 1. Check current stats ──
SELECT * FROM get_daily_usage_stats('f4679fa9-3120-4a59-9506-d059b010c34a');

-- ── 2. View today's suggestions with usage data ──
SELECT 
  id,
  position,
  title,
  text_generated_count,
  first_text_generated_at,
  last_text_generated_at,
  is_active
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND date = CURRENT_DATE
ORDER BY position;

-- ── 3. Simulate text generation (uncomment to test) ──
-- SELECT record_text_generation(13);  -- Replace 13 with actual suggestion ID
-- SELECT record_text_generation(13);  -- Generate again
-- SELECT record_text_generation(13);  -- Generate third time

-- ── 4. Check stats again (should increment) ──
-- SELECT * FROM get_daily_usage_stats('f4679fa9-3120-4a59-9506-d059b010c34a');

-- ── 5. View detailed suggestion tracking ──
-- SELECT 
--   id,
--   title,
--   text_generated_count AS "Genereret antal gange",
--   first_text_generated_at AS "Første gang",
--   last_text_generated_at AS "Seneste gang"
-- FROM daily_suggestions
-- WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
--   AND date = CURRENT_DATE
--   AND text_generated_count > 0
-- ORDER BY text_generated_count DESC;
