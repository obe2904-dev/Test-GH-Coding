-- ============================================================
-- Consolidate post_drafts and published_posts into single posts table
-- Date: 2026-06-20
--
-- SAFE TO RUN: No live users, no data migration needed.
--
-- Benefits:
-- - Single source of truth for all post states
-- - No data migration between tables
-- - Simpler queries and timeline views
-- - Complete post lifecycle history
-- - Atomic status updates (draft → scheduled → published)
--
-- Post lifecycle:
--   draft     → Work in progress (Idea → Design → Udgiv)
--   scheduled → Future posting planned
--   published → Already posted to social media
--   archived  → Hidden/deleted by user
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: Rename published_posts to posts
-- ============================================================

ALTER TABLE IF EXISTS public.published_posts 
  RENAME TO posts;

-- Update constraint names to match new table name
DO $$
DECLARE
  constraint_rec RECORD;
BEGIN
  -- Rename all constraints that start with published_posts_
  FOR constraint_rec IN 
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.posts'::regclass 
      AND conname LIKE 'published_posts_%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.posts RENAME CONSTRAINT %I TO %I',
      constraint_rec.conname,
      replace(constraint_rec.conname, 'published_posts_', 'posts_')
    );
  END LOOP;
END $$;

-- ============================================================
-- STEP 2: Add missing columns from post_drafts
-- ============================================================

-- Core draft content (matches actual post_drafts schema)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS content_json JSONB,
  ADD COLUMN IF NOT EXISTS photo_idea TEXT,
  ADD COLUMN IF NOT EXISTS platforms TEXT[] DEFAULT '{}';

-- Extended metadata
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS idea_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS media_analysis JSONB,
  ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'publish',
  ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES public.weekly_content_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idea_index INT DEFAULT 0;

-- Suggested posting time from AI
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS suggested_post_datetime TIMESTAMPTZ;

-- Timestamp tracking
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- STEP 3: Ensure status column supports 'archived'
-- ============================================================

-- Drop existing status constraint if it exists
ALTER TABLE public.posts 
  DROP CONSTRAINT IF EXISTS posts_status_check;

-- Add new status constraint with 'archived' support
ALTER TABLE public.posts
  ADD CONSTRAINT posts_status_check 
    CHECK (status IN ('draft', 'scheduled', 'published', 'archived'));

-- ============================================================
-- STEP 4: Update platform column to be nullable
-- ============================================================

-- Platform is NULL during Idea+Design stages (unified draft)
-- Platform is set to specific platform during Udgiv stage (platform split)
ALTER TABLE public.posts
  ALTER COLUMN platform DROP NOT NULL;

-- Update platform constraint to be nullable
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_platform_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_platform_check 
    CHECK (platform IS NULL OR platform IN ('facebook', 'instagram'));

-- ============================================================
-- STEP 5: Update idea_source constraint
-- ============================================================

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_idea_source_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_idea_source_check 
    CHECK (idea_source IN ('write', 'quick_suggestions', 'weekly_plan', 'manual'));

-- ============================================================
-- STEP 6: Make suggestion_id nullable integer (not UUID)
-- ============================================================

-- The suggestion_id references daily_suggestions.id which is INTEGER, not UUID
-- If the column was created as UUID, we need to fix this
DO $$
BEGIN
  -- Check current data type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'posts'
      AND column_name = 'suggestion_id'
      AND data_type = 'uuid'
  ) THEN
    -- Drop the column and recreate as INTEGER
    ALTER TABLE public.posts DROP COLUMN suggestion_id;
    ALTER TABLE public.posts ADD COLUMN suggestion_id INTEGER;
  END IF;
END $$;

-- Ensure it's INTEGER if not already
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS suggestion_id INTEGER;

-- ============================================================
-- STEP 7: Update scheduled_for to TIMESTAMPTZ (was DATE)
-- ============================================================

-- Change from DATE to TIMESTAMPTZ to store exact posting time
ALTER TABLE public.posts
  ALTER COLUMN scheduled_for TYPE TIMESTAMPTZ USING scheduled_for::TIMESTAMPTZ;

-- ============================================================
-- STEP 8: Drop old indexes and create new optimized ones
-- ============================================================

-- Drop old published_posts indexes
DROP INDEX IF EXISTS idx_published_posts_business_at;
DROP INDEX IF EXISTS idx_published_posts_weekly_plan;
DROP INDEX IF EXISTS idx_published_posts_status;
DROP INDEX IF EXISTS idx_published_posts_scheduled;
DROP INDEX IF EXISTS idx_published_posts_idea_source;
DROP INDEX IF EXISTS idx_published_posts_source;
DROP INDEX IF EXISTS idx_published_posts_suggestion;
DROP INDEX IF EXISTS idx_published_posts_weekly_slot;
DROP INDEX IF EXISTS idx_published_posts_weekly_idea;
DROP INDEX IF EXISTS idx_published_posts_status_scheduled;

-- Create new optimized indexes for posts table

-- Primary query index: business + status
CREATE INDEX IF NOT EXISTS idx_posts_business_status 
  ON public.posts(business_id, status, created_at DESC);

-- Drafts query (for timeline and recovery)
CREATE INDEX IF NOT EXISTS idx_posts_drafts
  ON public.posts(business_id, updated_at DESC)
  WHERE status = 'draft';

-- Scheduled posts query (for timeline and publishing queue)
CREATE INDEX IF NOT EXISTS idx_posts_scheduled
  ON public.posts(business_id, scheduled_for ASC)
  WHERE status = 'scheduled';

-- Published posts query (for timeline and history)
CREATE INDEX IF NOT EXISTS idx_posts_published
  ON public.posts(business_id, posted_at DESC)
  WHERE status = 'published';

-- Weekly plan linkage (by slot date - preferred key)
CREATE INDEX IF NOT EXISTS idx_posts_weekly_plan_slot
  ON public.posts(business_id, weekly_plan_slot_date, status)
  WHERE weekly_plan_slot_date IS NOT NULL;

-- Quick suggestions linkage
CREATE INDEX IF NOT EXISTS idx_posts_suggestion
  ON public.posts(business_id, suggestion_id, status)
  WHERE suggestion_id IS NOT NULL;

-- Menu item rotation tracking (for 14-day recency filter)
CREATE INDEX IF NOT EXISTS idx_posts_menu_rotation
  ON public.posts(business_id, menu_item_name, posted_at DESC)
  WHERE status = 'published' AND menu_item_name IS NOT NULL;

-- Content type recency tracking
CREATE INDEX IF NOT EXISTS idx_posts_content_recency
  ON public.posts(business_id, content_type, posted_at DESC)
  WHERE status = 'published' AND content_type IS NOT NULL;

-- User's all posts (for user dashboard)
CREATE INDEX IF NOT EXISTS idx_posts_user
  ON public.posts(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- ============================================================
-- STEP 9: Update RLS policies for new table name
-- ============================================================

-- Drop old published_posts policies
DROP POLICY IF EXISTS "Users can read own business posts" ON public.posts;
DROP POLICY IF EXISTS "Users can insert own business posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update own business posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete own business posts" ON public.posts;

-- Create new policies that work for both business_id and user_id
-- (Drafts may only have user_id initially, published posts have business_id)

CREATE POLICY "Users can read own posts"
  ON public.posts FOR SELECT
  USING (
    -- Match by business_id (for published posts and Udgiv-stage drafts)
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
    OR
    -- Match by user_id (for early-stage drafts before business context is set)
    user_id = auth.uid()
  );

CREATE POLICY "Users can insert own posts"
  ON public.posts FOR INSERT
  WITH CHECK (
    -- Must match either business_id or user_id
    (business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    ))
    OR
    (user_id = auth.uid())
  );

CREATE POLICY "Users can update own posts"
  ON public.posts FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
    OR
    user_id = auth.uid()
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
    OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can delete own posts"
  ON public.posts FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
    OR
    user_id = auth.uid()
  );

-- ============================================================
-- STEP 10: Drop post_drafts table
-- ============================================================

DROP TABLE IF EXISTS public.post_drafts CASCADE;

-- ============================================================
-- STEP 11: Update table and column comments
-- ============================================================

COMMENT ON TABLE public.posts IS 
  'Unified post storage for complete lifecycle: draft (working) → scheduled (planned) → published (live) → archived (hidden). Supports all creation paths: Skriv selv, Lav opslag nu, and Ugentlig plan.';

COMMENT ON COLUMN public.posts.status IS 
  'Lifecycle status: draft (work in progress), scheduled (planned for future), published (live on social media), archived (hidden/deleted)';

COMMENT ON COLUMN public.posts.platform IS 
  'Target platform (NULL during Idea+Design stages, set to specific platform during Udgiv stage split): facebook, instagram';

COMMENT ON COLUMN public.posts.platforms IS
  'Array of selected platforms during Design stage (before platform split in Udgiv)';

COMMENT ON COLUMN public.posts.scheduled_for IS 
  'Exact datetime when post should be published (NULL for immediate posts or drafts)';

COMMENT ON COLUMN public.posts.posted_at IS 
  'User-selected time of posting (adjustable in manual modal, set when status → published)';

COMMENT ON COLUMN public.posts.published_at IS 
  'Alias of posted_at, kept for backwards compatibility with opportunity-selector recency queries';

COMMENT ON COLUMN public.posts.idea_source IS 
  'Creation path: write (Skriv selv), quick_suggestions (Lav opslag nu), weekly_plan (Ugentlig plan), manual (legacy)';

COMMENT ON COLUMN public.posts.suggestion_id IS 
  'FK to daily_suggestions.id when idea_source = quick_suggestions';

COMMENT ON COLUMN public.posts.weekly_plan_slot_date IS 
  'ISO date (YYYY-MM-DD) of weekly plan slot when idea_source = weekly_plan. Preferred key for weekly plan posts.';

COMMENT ON COLUMN public.posts.content_json IS
  'Full PostContent snapshot: text, hashtags, adjustments, platform-specific content. Main content storage for drafts.';

COMMENT ON COLUMN public.posts.photo_idea IS
  'AI-generated photo suggestion text from Idea stage';

COMMENT ON COLUMN public.posts.updated_at IS
  'Last update timestamp for draft tracking and cleanup of stale drafts';

COMMENT ON COLUMN public.posts.idea_data IS
  'Snapshot of original AI suggestion data at draft creation time. Preserved even if weekly plan is regenerated.';

COMMENT ON COLUMN public.posts.media_analysis IS
  'AI photo/video analysis result (from analyze-photo edge function). Preserved across draft recovery.';

COMMENT ON COLUMN public.posts.phase IS
  'Draft workflow phase: idea, create, publish. Used for draft recovery to resume at correct step.';

COMMENT ON COLUMN public.posts.strategy_id IS
  'FK to weekly_content_plans.id when post came from weekly plan. Links post back to original strategy.';

COMMENT ON COLUMN public.posts.suggested_post_datetime IS
  'AI-recommended posting datetime from original suggestion or weekly plan. Preserved for user reference even if time is past.';

-- ============================================================
-- STEP 12: Verify migration success
-- ============================================================

DO $$
DECLARE
  table_exists BOOLEAN;
  col_count INTEGER;
  index_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Check posts table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'posts'
  ) INTO table_exists;

  IF table_exists THEN
    RAISE NOTICE '✅ posts table exists';
  ELSE
    RAISE EXCEPTION '❌ posts table does NOT exist!';
  END IF;

  -- Check post_drafts is dropped
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'post_drafts'
  ) INTO table_exists;

  IF NOT table_exists THEN
    RAISE NOTICE '✅ post_drafts table dropped successfully';
  ELSE
    RAISE WARNING '⚠️  post_drafts table still exists!';
  END IF;

  -- Count essential columns
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'posts'
    AND column_name IN (
      'status', 'platform', 'platforms', 'scheduled_for', 
      'post_text', 'photo_url', 'content_json', 'photo_idea',
      'idea_source', 'suggestion_id', 'weekly_plan_slot_date',
      'suggested_post_datetime', 'phase', 'idea_data', 'updated_at'
    );

  RAISE NOTICE '✅ Found % essential columns in posts table', col_count;

  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'posts';

  RAISE NOTICE '✅ Created % indexes on posts table', index_count;

  -- Count RLS policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'posts';

  RAISE NOTICE '✅ Created % RLS policies on posts table', policy_count;

  -- Show final schema
  RAISE NOTICE '📋 Final posts table schema:';
END $$;

-- Display final column list
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'posts'
ORDER BY ordinal_position;

COMMIT;

-- ============================================================
-- Migration complete! ✅
--
-- Next steps:
-- 1. Update TypeScript hooks to use posts table
-- 2. Remove usePostDrafts and usePublishedPosts
-- 3. Create unified usePosts hook
-- 4. Update PublishStep component
-- 5. Test full flow: write → design → udgiv → publish
-- ============================================================
