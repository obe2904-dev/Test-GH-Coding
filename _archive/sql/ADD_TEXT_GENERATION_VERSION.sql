-- Add text_generation_version to daily_suggestions.
-- Rows with version < current constant in CreatePostPage.tsx are treated as stale
-- and regenerated on next click, regardless of platforms_generated match.
-- Default 0 ensures all existing cached text is regenerated at least once.
ALTER TABLE public.daily_suggestions
  ADD COLUMN IF NOT EXISTS text_generation_version INTEGER NOT NULL DEFAULT 0;
