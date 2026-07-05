-- =====================================================
-- MIGRATION: Add Contextual Reasoning to Daily Suggestions
-- =====================================================
-- Adds context_reasoning and alternative_timings columns for paid tier feature
-- These provide strategic insights about why a suggestion makes sense NOW
-- =====================================================

-- Add context_reasoning column (paid tier feature)
ALTER TABLE daily_suggestions
  ADD COLUMN IF NOT EXISTS context_reasoning TEXT;

COMMENT ON COLUMN daily_suggestions.context_reasoning IS
  'Paid tier: Contextual explanation with day/time/weather context. Example: "I dag er lørdag formiddag og vejret er perfekt - derfor er mit bedste forslag..."';

-- Add alternative_timings column (paid tier feature)
ALTER TABLE daily_suggestions
  ADD COLUMN IF NOT EXISTS alternative_timings JSONB;

COMMENT ON COLUMN daily_suggestions.alternative_timings IS
  'Paid tier: Array of alternative posting times with reasoning. Format: [{"time": "14:00", "reasoning": "Eftermiddagsgæster søger ofte en sen frokost"}]';
