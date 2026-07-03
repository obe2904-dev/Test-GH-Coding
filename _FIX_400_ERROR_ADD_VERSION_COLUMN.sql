-- Quick fix: Add missing text_generation_version column
-- This is causing 400 errors when saving generated content

ALTER TABLE public.daily_suggestions
ADD COLUMN IF NOT EXISTS text_generation_version INTEGER;

COMMENT ON COLUMN public.daily_suggestions.text_generation_version IS 'Version number of text generation prompt that created this content';
