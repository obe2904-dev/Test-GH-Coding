-- ============================================================
-- Rollback per-platform drafts (temporary)
-- Date: 2026-06-22
--
-- The per-platform draft system is correct for the Udgiv step,
-- but the current code splits too early. This migration removes
-- the platform-specific uniqueness constraints so we can have
-- ONE draft during Create/Design steps (platform=NULL).
--
-- The split into per-platform rows should happen when navigating
-- TO the Udgiv step, not before.
-- ============================================================

-- Drop the platform-specific unique indexes
DROP INDEX IF EXISTS idx_post_drafts_unique_platform_weekly;
DROP INDEX IF EXISTS idx_post_drafts_unique_platform_suggestion;
DROP INDEX IF EXISTS idx_post_drafts_unique_platform_write;
DROP INDEX IF EXISTS idx_post_drafts_platform;

-- Recreate simple uniqueness constraints (without platform)
-- These allow ONE draft per idea during Create/Design steps

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_drafts_unique_weekly
  ON public.post_drafts (business_id, weekly_plan_slot_date)
  WHERE weekly_plan_slot_date IS NOT NULL AND platform IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_drafts_unique_suggestion
  ON public.post_drafts (business_id, suggestion_id, idea_source)
  WHERE suggestion_id IS NOT NULL AND platform IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_drafts_unique_write
  ON public.post_drafts (business_id, idea_source)
  WHERE idea_source = 'write' AND platform IS NULL;

-- Keep platform column for future use (Udgiv split)
-- but make it explicitly nullable
ALTER TABLE public.post_drafts
  ALTER COLUMN platform DROP NOT NULL;

COMMENT ON COLUMN public.post_drafts.platform IS
  'NULL during Create/Design steps (unified draft). Split into platform-specific rows when user navigates to Udgiv step.';

COMMENT ON TABLE post_drafts IS
  'Post drafts in progress. ONE row (platform=NULL) during Create/Design. Split into per-platform rows in Udgiv step before confirming timing.';
