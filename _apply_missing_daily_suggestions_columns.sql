-- =====================================================
-- APPLY MISSING COLUMNS TO daily_suggestions
-- =====================================================
-- Run this ONLY if _check_daily_suggestions_columns.sql shows missing columns
-- =====================================================

-- Add generated content caching columns
ALTER TABLE daily_suggestions
ADD COLUMN IF NOT EXISTS generated_text TEXT,
ADD COLUMN IF NOT EXISTS generated_hashtags JSONB,
ADD COLUMN IF NOT EXISTS generated_platform_content JSONB,
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS platforms_generated TEXT[],
ADD COLUMN IF NOT EXISTS text_generation_version INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN public.daily_suggestions.generated_text IS 'Shared/Facebook text generated from this idea';
COMMENT ON COLUMN public.daily_suggestions.generated_hashtags IS 'Array of hashtag objects with platforms: [{tag: "#food", platforms: ["facebook", "instagram"], enabled: true}]';
COMMENT ON COLUMN public.daily_suggestions.generated_platform_content IS 'Platform-specific content variants: {facebook: {text, hashtags}, instagram: {text, hashtags}}';
COMMENT ON COLUMN public.daily_suggestions.generated_at IS 'Timestamp when text was generated (for cache invalidation)';
COMMENT ON COLUMN public.daily_suggestions.platforms_generated IS 'Which platforms this content was generated for: ["facebook", "instagram"]';
COMMENT ON COLUMN public.daily_suggestions.text_generation_version IS 'Version number of text generation prompt that created this content (e.g., 8 = V5.5 Tone DNA)';

-- Add index for cache lookup performance
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_generation_cache
  ON daily_suggestions(text_generation_version, generated_at) 
  WHERE generated_at IS NOT NULL;

-- Verify columns were added
SELECT 
  'Success! Columns added' AS message,
  COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'daily_suggestions'
  AND column_name IN (
    'generated_text',
    'generated_hashtags',
    'generated_platform_content',
    'generated_at',
    'platforms_generated',
    'text_generation_version'
  );

-- Expected result: column_count = 6
