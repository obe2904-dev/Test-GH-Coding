-- Store generated content with daily suggestions to avoid regenerating same idea
-- When user selects an idea and generates content, we store it here for instant recall

ALTER TABLE public.daily_suggestions
ADD COLUMN IF NOT EXISTS generated_text TEXT,
ADD COLUMN IF NOT EXISTS generated_hashtags JSONB,
ADD COLUMN IF NOT EXISTS generated_platform_content JSONB,
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS platforms_generated TEXT[];

COMMENT ON COLUMN public.daily_suggestions.generated_text IS 'Shared/Facebook text generated from this idea';
COMMENT ON COLUMN public.daily_suggestions.generated_hashtags IS 'Array of hashtag objects with platforms: [{tag: "#food", platforms: ["facebook", "instagram"], enabled: true}]';
COMMENT ON COLUMN public.daily_suggestions.generated_platform_content IS 'Platform-specific content variants: {facebook: {text, hashtags}, instagram: {text, hashtags}}';
COMMENT ON COLUMN public.daily_suggestions.generated_at IS 'When content was generated for this idea';
COMMENT ON COLUMN public.daily_suggestions.platforms_generated IS 'Which platforms this content was generated for: ["facebook", "instagram"]';
