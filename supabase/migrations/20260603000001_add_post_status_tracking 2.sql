-- =====================================================
-- Migration: Add status tracking to published_posts
-- Date: 2026-06-03
-- 
-- Extends published_posts to support draft and scheduled posts
-- in addition to published posts, enabling a unified post lifecycle.
--
-- Benefits:
-- - Single table for all post states (draft → scheduled → published)
-- - Natural status progression without data migration
-- - Simpler timeline queries
-- - Support for Weekly Plan scheduling
-- =====================================================

-- ── 1. Add status column ──────────────────────────────────────
-- Tracks lifecycle: draft (working), scheduled (planned), published (live)
ALTER TABLE published_posts 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published'
    CHECK (status IN ('draft', 'scheduled', 'published'));

COMMENT ON COLUMN published_posts.status IS 
  'Lifecycle status: draft (working), scheduled (planned for future), published (live)';

-- ── 2. Add scheduled_for column ───────────────────────────────
-- Target date for scheduled posts (NULL for immediate/manual posts)
ALTER TABLE published_posts
  ADD COLUMN IF NOT EXISTS scheduled_for DATE;

COMMENT ON COLUMN published_posts.scheduled_for IS 
  'Target posting date for scheduled posts. NULL for immediate posts or already-published posts.';

-- ── 3. Add idea_source column ─────────────────────────────────
-- Track where the post idea originated
ALTER TABLE published_posts
  ADD COLUMN IF NOT EXISTS idea_source TEXT DEFAULT 'manual'
    CHECK (idea_source IN ('manual', 'quick_suggestions', 'weekly_plan'));

COMMENT ON COLUMN published_posts.idea_source IS 
  'Origin of post idea: manual (user-created), quick_suggestions (AI Ideas), weekly_plan (from strategy)';

-- ── 4. Add suggestion_id column ───────────────────────────────
-- Link back to daily_suggestions if post came from Quick Suggestions
ALTER TABLE published_posts
  ADD COLUMN IF NOT EXISTS suggestion_id UUID;

COMMENT ON COLUMN published_posts.suggestion_id IS 
  'FK to daily_suggestions.id if this post originated from a Quick Suggestion (idea_source = quick_suggestions)';

-- ── 5. Add caption_data column ────────────────────────────────
-- Store generated caption with hashtags, CTA, platform variants
ALTER TABLE published_posts
  ADD COLUMN IF NOT EXISTS caption_data JSONB;

COMMENT ON COLUMN published_posts.caption_data IS 
  'Generated caption metadata: { text, hashtags, ctaType, platformVariants }. Preserved from generation step.';

-- ── 6. Add media_metadata column ──────────────────────────────
-- Store photo analysis and media suggestions
ALTER TABLE published_posts
  ADD COLUMN IF NOT EXISTS media_metadata JSONB;

COMMENT ON COLUMN published_posts.media_metadata IS 
  'Media analysis and suggestions: { photo_idea, photo_analysis, media_suggestion }';

-- ── 7. Update existing rows ───────────────────────────────────
-- Set all existing records to status = 'published' (they are already published)
UPDATE published_posts 
SET status = 'published' 
WHERE status IS NULL;

-- ── 8. Create indexes ─────────────────────────────────────────

-- Index for draft/scheduled queries by business
CREATE INDEX IF NOT EXISTS idx_published_posts_status
  ON published_posts(business_id, status, scheduled_for)
  WHERE status IN ('draft', 'scheduled');

-- Index for scheduled posts (query-time filtering for date)
CREATE INDEX IF NOT EXISTS idx_published_posts_scheduled
  ON published_posts(scheduled_for, status)
  WHERE status = 'scheduled';

-- Index for idea source tracking
CREATE INDEX IF NOT EXISTS idx_published_posts_idea_source
  ON published_posts(business_id, idea_source)
  WHERE idea_source IN ('quick_suggestions', 'weekly_plan');

-- ── 9. Update table comment ───────────────────────────────────
COMMENT ON TABLE published_posts IS 
  'Unified post storage for all lifecycle states: draft (working), scheduled (planned), published (live). Supports Quick Suggestions, Weekly Plan, and manual posts.';

-- ── 10. Verify changes ────────────────────────────────────────
DO $$
DECLARE
  col_count INTEGER;
BEGIN
  -- Check that all new columns exist
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'published_posts'
    AND column_name IN ('status', 'scheduled_for', 'idea_source', 'suggestion_id', 'caption_data', 'media_metadata');
  
  IF col_count = 6 THEN
    RAISE NOTICE '✅ All 6 new columns added successfully';
  ELSE
    RAISE WARNING '⚠️  Expected 6 columns, found %', col_count;
  END IF;
  
  -- Check existing records have status
  SELECT COUNT(*) INTO col_count
  FROM published_posts
  WHERE status IS NULL;
  
  IF col_count = 0 THEN
    RAISE NOTICE '✅ All existing posts have status = published';
  ELSE
    RAISE WARNING '⚠️  % posts still have NULL status', col_count;
  END IF;
END $$;

-- ── 11. Display updated schema ────────────────────────────────
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'published_posts'
ORDER BY ordinal_position;
