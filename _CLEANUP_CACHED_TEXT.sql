-- ============================================================
-- CLEANUP: Clear cached text from active suggestions
-- Date: 2026-06-10
-- 
-- Run this AFTER applying _FIX_REGENERATE_CACHE.sql
-- Clears any existing cached text from currently active suggestions
-- so next regeneration will generate fresh text.
-- ============================================================

-- Clear cached text from all active suggestions for today
UPDATE daily_suggestions
SET generated_text = NULL,
    generated_hashtags = NULL,
    generated_platform_content = NULL,
    generated_at = NULL,
    platforms_generated = NULL,
    text_generation_version = NULL
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND is_active = true
  AND date = CURRENT_DATE;

-- Verify cleanup
SELECT 
  id,
  title,
  is_active,
  CASE 
    WHEN generated_text IS NULL THEN '✅ Cleared'
    ELSE '⚠️ Still has cache'
  END as cache_status
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND is_active = true
  AND date = CURRENT_DATE;
