-- ============================================================
-- Extend published_posts with full backward traceability
-- Date: 2026-06-20
--
-- Adds source tracking and metadata fields so published posts
-- preserve complete information about their origin (Skriv selv,
-- Lav opslag nu, or Ugentlig plan) and AI-generated context.
-- ============================================================

-- Add source tracking columns
ALTER TABLE public.published_posts
  ADD COLUMN IF NOT EXISTS idea_source TEXT,
  ADD COLUMN IF NOT EXISTS suggestion_id INTEGER,
  ADD COLUMN IF NOT EXISTS weekly_plan_idea_id INTEGER,
  ADD COLUMN IF NOT EXISTS weekly_plan_slot_date DATE,
  ADD COLUMN IF NOT EXISTS original_idea_title TEXT,
  ADD COLUMN IF NOT EXISTS original_idea_content JSONB,
  ADD COLUMN IF NOT EXISTS suggested_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cta_intent TEXT,
  ADD COLUMN IF NOT EXISTS content_type TEXT;

-- Add status tracking (replaces implicit status based on scheduled_at)
ALTER TABLE public.published_posts
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS posting_error TEXT;

-- Add status constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'published_posts_status_check'
      AND conrelid = 'public.published_posts'::regclass
  ) THEN
    ALTER TABLE public.published_posts
      ADD CONSTRAINT published_posts_status_check
      CHECK (status IN ('scheduled', 'published', 'failed'));
  END IF;
END $$;

-- Add idea_source constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'published_posts_idea_source_check'
      AND conrelid = 'public.published_posts'::regclass
  ) THEN
    ALTER TABLE public.published_posts
      ADD CONSTRAINT published_posts_idea_source_check
      CHECK (idea_source IN ('write', 'quick_suggestions', 'weekly_plan'));
  END IF;
END $$;

-- Backfill status for existing rows
UPDATE public.published_posts
SET status = CASE
  WHEN published_at IS NOT NULL THEN 'published'
  WHEN scheduled_at <= NOW() THEN 'published'
  ELSE 'scheduled'
END
WHERE status IS NULL OR status = 'scheduled';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_published_posts_source
  ON public.published_posts (business_id, idea_source, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_published_posts_suggestion
  ON public.published_posts (business_id, suggestion_id)
  WHERE suggestion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_published_posts_weekly_slot
  ON public.published_posts (business_id, weekly_plan_slot_date)
  WHERE weekly_plan_slot_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_published_posts_weekly_idea
  ON public.published_posts (business_id, weekly_plan_idea_id)
  WHERE weekly_plan_idea_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_published_posts_status_scheduled
  ON public.published_posts (business_id, status, scheduled_at)
  WHERE status = 'scheduled';

-- Comments
COMMENT ON COLUMN public.published_posts.idea_source IS
  'Origin flow: write (Skriv selv), quick_suggestions (Lav opslag nu), or weekly_plan (Ugentlig plan)';

COMMENT ON COLUMN public.published_posts.suggestion_id IS
  'Links to daily_suggestions.id for quick_suggestions posts';

COMMENT ON COLUMN public.published_posts.weekly_plan_slot_date IS
  'ISO date of weekly plan slot for weekly_plan posts';

COMMENT ON COLUMN public.published_posts.weekly_plan_idea_id IS
  'Stable per-idea identifier from weekly_content_plans.posts[].idea_id for weekly_plan posts';

COMMENT ON COLUMN public.published_posts.original_idea_title IS
  'Original AI-generated idea title (e.g., "Tonkatsu Special")';

COMMENT ON COLUMN public.published_posts.original_idea_content IS
  'Full AI suggestion data for audit/rollback';

COMMENT ON COLUMN public.published_posts.status IS
  'Post lifecycle: scheduled (future), published (posted), failed (API error)';
