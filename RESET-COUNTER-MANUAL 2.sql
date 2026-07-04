-- =====================================================
-- MANUAL COUNTER RESET - 17. maj 2026
-- =====================================================
-- Run this to manually reset the counter to 0 for testing

UPDATE businesses
SET quick_suggestions_today = 0
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Verify the reset
SELECT 
  quick_suggestions_today AS "Counter Value",
  last_quick_suggestions_reset AS "Last Reset Date",
  CURRENT_DATE AS "Today's Date"
FROM businesses 
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
