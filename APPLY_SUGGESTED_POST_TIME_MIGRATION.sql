-- =====================================================
-- APPLY THIS MIGRATION MANUALLY VIA SUPABASE DASHBOARD
-- =====================================================
-- 
-- Migration: Add suggested_post_time to published_posts
-- Date: 2026-06-04
--
-- HOW TO APPLY:
-- 1. Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
-- 2. Copy-paste this entire file into the SQL Editor
-- 3. Click "Run" button
-- 4. Verify success
--
-- =====================================================

-- ── 1. Add suggested_post_time column ─────────────────────────
ALTER TABLE published_posts 
  ADD COLUMN IF NOT EXISTS suggested_post_time TIME;

COMMENT ON COLUMN published_posts.suggested_post_time IS 
  'AI-recommended posting time from Quick Suggestions (e.g., 17:00). Preserved through draft → scheduled → published workflow to show user the optimal posting time.';

-- ── 2. Create index ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_published_posts_suggested_time
  ON published_posts(suggested_post_time)
  WHERE suggested_post_time IS NOT NULL AND idea_source = 'quick_suggestions';

-- ── 3. Verify changes ─────────────────────────────────────────
SELECT 
  'Migration completed successfully!' AS message,
  COUNT(*) FILTER (WHERE column_name = 'suggested_post_time') AS suggested_post_time_col
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'published_posts'
  AND column_name = 'suggested_post_time';

-- Expected result: suggested_post_time_col = 1
