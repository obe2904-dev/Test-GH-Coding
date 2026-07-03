-- =====================================================
-- RESET: Clear suggestions and counter for Cafe Faust
-- =====================================================
-- This allows fresh suggestion generation for testing

-- 1. Mark all current suggestions as inactive
UPDATE daily_suggestions
SET is_active = false
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND is_active = true;

-- 2. Reset text generation counters for today's suggestions
UPDATE daily_suggestions
SET 
  text_generated_count = 0,
  first_text_generated_at = NULL,
  last_text_generated_at = NULL
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND date = CURRENT_DATE;

-- 3. Verify reset
SELECT 
  id,
  title,
  content_type,
  is_active,
  text_generated_count,
  created_at
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND date = CURRENT_DATE
ORDER BY position;
