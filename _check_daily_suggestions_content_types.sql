-- =====================================================
-- Check what content_type values exist in daily_suggestions
-- =====================================================

SELECT 
  content_type,
  COUNT(*) AS row_count,
  MIN(created_at) AS earliest_suggestion,
  MAX(created_at) AS latest_suggestion
FROM daily_suggestions
GROUP BY content_type
ORDER BY row_count DESC;

-- This will show us:
-- 1. What content_type values exist
-- 2. How many rows have each value
-- 3. When they were created
--
-- Expected issue: Some rows have content_type values that are NOT:
-- 'product', 'experience', 'occasion', 'atmosphere', 'retention', 'team'
