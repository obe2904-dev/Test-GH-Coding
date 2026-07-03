-- Add structured media suggestion to daily_suggestions.
-- Stores the full Gemini-generated media recommendation object:
-- { primary: { type: "photo", instruction: "..." }, alternatives: [...] }
-- photo_idea TEXT is kept as plain-text fallback (= primary.instruction).
ALTER TABLE public.daily_suggestions
  ADD COLUMN IF NOT EXISTS media_suggestion JSONB;

COMMENT ON COLUMN public.daily_suggestions.media_suggestion IS
  'Structured media recommendation from Gemini: { primary: { type: "photo", instruction: "..." }, alternatives: [{ type: "reel"|"carousel", instruction: "..." }] }';
