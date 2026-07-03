-- =====================================================
-- FIX: Add missing photo columns to daily_suggestions
-- =====================================================
-- This fixes the 400 error when loading suggestions

-- Add uploaded_photo_url column
ALTER TABLE public.daily_suggestions 
ADD COLUMN IF NOT EXISTS uploaded_photo_url TEXT;

-- Add photo_analysis column
ALTER TABLE public.daily_suggestions 
ADD COLUMN IF NOT EXISTS photo_analysis JSONB;

-- Add media_items column (stores uploaded photos/videos)
ALTER TABLE public.daily_suggestions 
ADD COLUMN IF NOT EXISTS media_items JSONB;

-- Add comments
COMMENT ON COLUMN public.daily_suggestions.uploaded_photo_url IS 'URL of the actual uploaded photo for this suggestion';
COMMENT ON COLUMN public.daily_suggestions.photo_analysis IS 'AI analysis result from Gemini (feedback, tips, categories)';
COMMENT ON COLUMN public.daily_suggestions.media_items IS 'Array of uploaded media items (photos/videos) with URLs and adjustments';

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_photo 
ON public.daily_suggestions(uploaded_photo_url) 
WHERE uploaded_photo_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_suggestions_media 
ON public.daily_suggestions USING gin(media_items) 
WHERE media_items IS NOT NULL;

-- Verify all three columns exist
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'daily_suggestions'
  AND table_schema = 'public'
  AND column_name IN ('uploaded_photo_url', 'photo_analysis', 'media_items')
ORDER BY column_name;
