-- Run this SQL in your Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste and Run

-- Add column to store uploaded media items (photos/videos) for suggestions
ALTER TABLE public.daily_suggestions 
ADD COLUMN IF NOT EXISTS media_items JSONB;

-- Add comment
COMMENT ON COLUMN public.daily_suggestions.media_items IS 'Array of uploaded media items (photos/videos) with URLs and adjustments';

-- Add GIN index for faster JSONB queries
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_media 
ON public.daily_suggestions USING gin(media_items) 
WHERE media_items IS NOT NULL;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'daily_suggestions' 
AND column_name = 'media_items';
