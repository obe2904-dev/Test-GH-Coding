-- Add columns to store uploaded photo and AI analysis in daily_suggestions

ALTER TABLE public.daily_suggestions 
ADD COLUMN IF NOT EXISTS uploaded_photo_url TEXT,
ADD COLUMN IF NOT EXISTS photo_analysis JSONB;

-- Add comments
COMMENT ON COLUMN public.daily_suggestions.uploaded_photo_url IS 'URL of the actual uploaded photo for this suggestion';
COMMENT ON COLUMN public.daily_suggestions.photo_analysis IS 'AI analysis result from Gemini (feedback, tips, categories)';

-- Add index for faster queries when filtering by photos
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_photo 
ON public.daily_suggestions(uploaded_photo_url) 
WHERE uploaded_photo_url IS NOT NULL;
