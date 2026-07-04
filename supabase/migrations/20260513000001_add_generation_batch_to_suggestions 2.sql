-- Add generation_batch_id to daily_suggestions for better tracking
-- Allows keeping all suggestions in DB while showing only latest batch in UI

ALTER TABLE public.daily_suggestions
  ADD COLUMN IF NOT EXISTS generation_batch_id UUID DEFAULT gen_random_uuid();

-- Index for efficient latest-batch queries
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_batch 
  ON public.daily_suggestions(business_id, date, generation_batch_id DESC);

COMMENT ON COLUMN public.daily_suggestions.generation_batch_id IS 'UUID identifying which regeneration batch this suggestion belongs to. UI shows only the latest batch per date.';
