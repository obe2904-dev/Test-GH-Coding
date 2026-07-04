-- Add text_generation_version column to track which prompt version generated the content
-- This helps understand quality changes over time as prompt evolves

ALTER TABLE public.daily_suggestions
ADD COLUMN IF NOT EXISTS text_generation_version INTEGER;

COMMENT ON COLUMN public.daily_suggestions.text_generation_version IS 'Version number of text generation prompt that created this content (e.g., 8 = V5.5 Tone DNA)';

-- Create index for analyzing quality by version
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_text_version 
  ON daily_suggestions(text_generation_version, generated_at) 
  WHERE generated_at IS NOT NULL;
