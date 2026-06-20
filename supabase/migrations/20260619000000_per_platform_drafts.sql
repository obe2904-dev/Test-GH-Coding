-- ============================================================
-- Per-platform draft support
-- Date: 2026-06-19
--
-- Adds platform column to post_drafts to support separate draft
-- rows per platform when multiple platforms are selected.
--
-- NOTE: Does NOT migrate existing drafts - they remain unchanged.
-- Only NEW drafts created going forward will use per-platform rows.
-- ============================================================

-- Add single platform column (nullable for backward compatibility)
ALTER TABLE public.post_drafts
  ADD COLUMN IF NOT EXISTS platform TEXT;

COMMENT ON COLUMN public.post_drafts.platform IS
  'Single platform for this draft (facebook, instagram, etc.). NULL for legacy combined drafts. New drafts will have one row per platform.';

-- Create unique index for platform-specific drafts
-- This prevents duplicate drafts for the same platform + idea
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_drafts_unique_platform_weekly
  ON public.post_drafts (business_id, platform, weekly_plan_slot_date)
  WHERE weekly_plan_slot_date IS NOT NULL AND platform IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_drafts_unique_platform_suggestion
  ON public.post_drafts (business_id, platform, suggestion_id, idea_source)
  WHERE suggestion_id IS NOT NULL AND platform IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_drafts_unique_platform_write
  ON public.post_drafts (business_id, platform, idea_source)
  WHERE idea_source = 'write' AND platform IS NOT NULL;

-- Index for efficient platform-specific lookups
CREATE INDEX IF NOT EXISTS idx_post_drafts_platform
  ON public.post_drafts(platform)
  WHERE platform IS NOT NULL;

-- Make platform NOT NULL after migration
-- (Commented out for safety - run manually after verifying migration)
-- ALTER TABLE public.post_drafts
--   ALTER COLUMN platform SET NOT NULL;
