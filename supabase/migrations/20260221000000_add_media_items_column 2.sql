-- Add column to store uploaded media items for suggestions

ALTER TABLE public.daily_suggestions 
ADD COLUMN IF NOT EXISTS media_items JSONB;

COMMENT ON COLUMN public.daily_suggestions.media_items IS 'Array of uploaded media items (photos/videos) with URLs and adjustments';

-- Create index for faster queries when filtering by media
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_media 
ON public.daily_suggestions USING gin(media_items) 
WHERE media_items IS NOT NULL;
