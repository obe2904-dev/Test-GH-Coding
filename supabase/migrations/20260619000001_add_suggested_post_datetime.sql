-- ============================================================
-- Add suggested posting time to post_drafts
-- Date: 2026-06-19
--
-- Preserves AI-recommended posting time from daily_suggestions
-- or weekly plan when draft is created. User can see this even
-- if suggested time is in the past.
-- ============================================================

-- Add suggested_post_datetime column
ALTER TABLE public.post_drafts
  ADD COLUMN IF NOT EXISTS suggested_post_datetime TIMESTAMPTZ;

COMMENT ON COLUMN public.post_drafts.suggested_post_datetime IS
  'AI-recommended posting time from original suggestion or weekly plan. Preserved for user reference even if time is in the past.';

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_post_drafts_suggested_datetime
  ON public.post_drafts(suggested_post_datetime)
  WHERE suggested_post_datetime IS NOT NULL;
