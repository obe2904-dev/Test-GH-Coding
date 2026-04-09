-- ============================================================
-- 20260302000000_extend_post_drafts_idea_context.sql
--
-- Creates post_drafts if it does not yet exist, then adds
-- idea source tracking, media analysis, caption data,
-- workflow phase, and weekly strategy linkage columns.
--
-- SAFE TO RUN MULTIPLE TIMES — CREATE TABLE IF NOT EXISTS +
-- all ALTER use ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- -------------------------------------------------------
-- 0. Create post_drafts base table (idempotent)
--    Mirrors 006_post_drafts.sql so this migration is
--    fully self-contained for fresh databases.
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.post_drafts (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_platforms TEXT[]    DEFAULT '{}',
  post_content     JSONB,
  photo_content    JSONB,
  photo_idea       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_drafts_user_id   ON public.post_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_post_drafts_updated_at ON public.post_drafts(updated_at DESC);

ALTER TABLE public.post_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'post_drafts'
      AND policyname = 'Users can view their own drafts'
  ) THEN
    CREATE POLICY "Users can view their own drafts"
      ON public.post_drafts FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'post_drafts'
      AND policyname = 'Users can insert their own drafts'
  ) THEN
    CREATE POLICY "Users can insert their own drafts"
      ON public.post_drafts FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'post_drafts'
      AND policyname = 'Users can update their own drafts'
  ) THEN
    CREATE POLICY "Users can update their own drafts"
      ON public.post_drafts FOR UPDATE TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'post_drafts'
      AND policyname = 'Users can delete their own drafts'
  ) THEN
    CREATE POLICY "Users can delete their own drafts"
      ON public.post_drafts FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- -------------------------------------------------------
-- 1. idea_source — where the idea came from
--    'user' | 'quick_suggestions' | 'weekly_plan'
-- -------------------------------------------------------
ALTER TABLE public.post_drafts
  ADD COLUMN IF NOT EXISTS idea_source TEXT DEFAULT 'user';

COMMENT ON COLUMN public.post_drafts.idea_source IS
  'Origin of the post idea: user (manual), quick_suggestions (Free AI Ideer), weekly_plan (from Weekly Plan card)';

-- -------------------------------------------------------
-- 2. idea_data — context snapshot from the idea source
--    For weekly_plan: { title, rationale, contentType,
--    suggestedDay, ctaIntent, suggestedMedia }
-- -------------------------------------------------------
ALTER TABLE public.post_drafts
  ADD COLUMN IF NOT EXISTS idea_data JSONB DEFAULT '{}';

COMMENT ON COLUMN public.post_drafts.idea_data IS
  'Snapshot of the idea context at time of draft creation. Preserved even if strategy is regenerated.';

-- -------------------------------------------------------
-- 3. media_analysis — result from AI photo analysis
--    Stored so the analysis survives draft recovery
-- -------------------------------------------------------
ALTER TABLE public.post_drafts
  ADD COLUMN IF NOT EXISTS media_analysis JSONB DEFAULT NULL;

COMMENT ON COLUMN public.post_drafts.media_analysis IS
  'AI photo/video analysis result (from analyze-photo edge function). Preserved across draft recovery.';

-- -------------------------------------------------------
-- 4. caption_data — generated caption + metadata
--    Stored at Generate step completion
-- -------------------------------------------------------
ALTER TABLE public.post_drafts
  ADD COLUMN IF NOT EXISTS caption_data JSONB DEFAULT NULL;

COMMENT ON COLUMN public.post_drafts.caption_data IS
  'Generated caption object including text, hashtags, ctaType, platform variants. Set when AI generation completes.';

-- -------------------------------------------------------
-- 5. phase — current wizard step
--    'idea' | 'create' | 'publish'
-- -------------------------------------------------------
ALTER TABLE public.post_drafts
  ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'idea';

COMMENT ON COLUMN public.post_drafts.phase IS
  'Current wizard step the draft is in: idea, create, or publish. Used for draft recovery to resume at the right step.';

-- -------------------------------------------------------
-- 6. strategy_id — FK to weekly_strategies
--    Set when idea_source = ''weekly_plan''
-- -------------------------------------------------------
ALTER TABLE public.post_drafts
  ADD COLUMN IF NOT EXISTS strategy_id UUID DEFAULT NULL
  REFERENCES public.weekly_strategies(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.post_drafts.strategy_id IS
  'FK to weekly_strategies. Set when the draft was created from a Weekly Plan card. Used to close the loop (mark plan card as posted).';

-- -------------------------------------------------------
-- 7. idea_index — which post in the strategy this is
--    0-based index into weekly_strategies.plan_data.posts
-- -------------------------------------------------------
ALTER TABLE public.post_drafts
  ADD COLUMN IF NOT EXISTS idea_index INT DEFAULT 0;

COMMENT ON COLUMN public.post_drafts.idea_index IS
  'Index (0-based) of the post in weekly_strategies.plan_data.posts this draft was created from.';

-- -------------------------------------------------------
-- 8. Index for strategy linkage lookups
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_post_drafts_strategy_id
  ON public.post_drafts(strategy_id)
  WHERE strategy_id IS NOT NULL;

-- -------------------------------------------------------
-- 9. Verify
-- -------------------------------------------------------
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'post_drafts'
  AND column_name  IN (
    'idea_source', 'idea_data', 'media_analysis',
    'caption_data', 'phase', 'strategy_id', 'idea_index'
  )
ORDER BY column_name;
