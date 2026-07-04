-- =====================================================
-- APPLY THIS MIGRATION MANUALLY VIA SUPABASE DASHBOARD
-- =====================================================
-- 
-- Migration: Add status tracking to published_posts
-- Date: 2026-06-03
--
-- HOW TO APPLY:
-- 1. Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
-- 2. Copy-paste this entire file into the SQL Editor
-- 3. Click "Run" button
-- 4. Verify success (should show "Success. No rows returned")
--
-- =====================================================

-- ── 1. Add status column ──────────────────────────────────────
ALTER TABLE published_posts 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published'
    CHECK (status IN ('draft', 'scheduled', 'published'));

COMMENT ON COLUMN published_posts.status IS 
  'Lifecycle status: draft (working), scheduled (planned for future), published (live)';

-- ── 2. Add scheduled_for column ───────────────────────────────
ALTER TABLE published_posts
  ADD COLUMN IF NOT EXISTS scheduled_for DATE;

COMMENT ON COLUMN published_posts.scheduled_for IS 
  'Target posting date for scheduled posts. NULL for immediate posts or already-published posts.';

-- ── 3. Add idea_source column ─────────────────────────────────
ALTER TABLE published_posts
  ADD COLUMN IF NOT EXISTS idea_source TEXT DEFAULT 'manual'
    CHECK (idea_source IN ('manual', 'quick_suggestions', 'weekly_plan'));

COMMENT ON COLUMN published_posts.idea_source IS 
  'Origin of post idea: manual (user-created), quick_suggestions (AI Ideas), weekly_plan (from strategy)';

-- ── 4. Add suggestion_id column ───────────────────────────────
ALTER TABLE published_posts
  ADD COLUMN IF NOT EXISTS suggestion_id UUID;

COMMENT ON COLUMN published_posts.suggestion_id IS 
  'FK to daily_suggestions.id if this post originated from a Quick Suggestion';

-- ── 5. Add caption_data column ────────────────────────────────
ALTER TABLE published_posts
  ADD COLUMN IF NOT EXISTS caption_data JSONB;

COMMENT ON COLUMN published_posts.caption_data IS 
  'Generated caption metadata: { text, hashtags, ctaType, platformVariants }';

-- ── 6. Add media_metadata column ──────────────────────────────
ALTER TABLE published_posts
  ADD COLUMN IF NOT EXISTS media_metadata JSONB;

COMMENT ON COLUMN published_posts.media_metadata IS 
  'Media analysis and suggestions: { photo_idea, photo_analysis, media_suggestion }';

-- ── 7. Update existing rows ───────────────────────────────────
UPDATE published_posts 
SET status = 'published' 
WHERE status IS NULL;

-- ── 8. Create indexes ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_published_posts_status
  ON published_posts(business_id, status, scheduled_for)
  WHERE status IN ('draft', 'scheduled');

CREATE INDEX IF NOT EXISTS idx_published_posts_scheduled
  ON published_posts(scheduled_for, status)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_published_posts_idea_source
  ON published_posts(business_id, idea_source)
  WHERE idea_source IN ('quick_suggestions', 'weekly_plan');

-- ── 9. Update table comment ───────────────────────────────────
COMMENT ON TABLE published_posts IS 
  'Unified post storage for all lifecycle states: draft, scheduled, published. Supports Quick Suggestions, Weekly Plan, and manual posts.';

-- ── 10. Allow updates to own business posts ───────────────────
DROP POLICY IF EXISTS "Allow update for business members" ON published_posts;

CREATE POLICY "Allow update for business members"
  ON published_posts
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id
      FROM businesses
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id
      FROM businesses
      WHERE user_id = auth.uid()
    )
  );

-- ── 10. Verify changes ────────────────────────────────────────
SELECT 
  'Migration completed successfully!' AS message,
  COUNT(*) FILTER (WHERE column_name = 'status') AS status_col,
  COUNT(*) FILTER (WHERE column_name = 'scheduled_for') AS scheduled_for_col,
  COUNT(*) FILTER (WHERE column_name = 'idea_source') AS idea_source_col,
  COUNT(*) FILTER (WHERE column_name = 'suggestion_id') AS suggestion_id_col,
  COUNT(*) FILTER (WHERE column_name = 'caption_data') AS caption_data_col,
  COUNT(*) FILTER (WHERE column_name = 'media_metadata') AS media_metadata_col
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'published_posts'
  AND column_name IN ('status', 'scheduled_for', 'idea_source', 'suggestion_id', 'caption_data', 'media_metadata');

-- Expected result: All columns should show "1"
