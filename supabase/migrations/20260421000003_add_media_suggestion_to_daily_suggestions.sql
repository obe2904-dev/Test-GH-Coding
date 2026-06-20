-- Migration: add media_suggestion jsonb column to daily_suggestions
--
-- Purpose: persist the full Gemini media_suggestion object (type, primary.instruction,
-- primary.type, alternatives) so that cached suggestions returned the next day carry
-- complete photography guidance — not just the plain-text photo_idea string.
--
-- photo_idea (text) is kept for backwards compatibility; it continues to hold
-- media_suggestion.primary.instruction as a flat string for existing reads.

ALTER TABLE daily_suggestions
  ADD COLUMN IF NOT EXISTS media_suggestion jsonb;
