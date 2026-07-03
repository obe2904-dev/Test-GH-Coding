-- Add daily quota tracking for quick suggestions (dashboard AI ideas)
-- FREE tier: 5 generations per day
-- PAID tier: 100 generations per day (safety limit)

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS quick_suggestions_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_quick_suggestions_reset DATE DEFAULT CURRENT_DATE;

-- Update existing reset function to include quick suggestions
CREATE OR REPLACE FUNCTION public.reset_daily_quotas()
RETURNS void AS $$
BEGIN
  UPDATE public.businesses
  SET 
    ai_generations_today = 0,
    pdf_uploads_today = 0,
    website_analysis_today = 0,
    quick_suggestions_today = 0,
    last_daily_reset = CURRENT_DATE,
    last_quick_suggestions_reset = CURRENT_DATE
  WHERE last_daily_reset < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN public.businesses.quick_suggestions_today IS 'Number of quick suggestion generations today (FREE: max 5/day, PAID: max 100/day)';
COMMENT ON COLUMN public.businesses.last_quick_suggestions_reset IS 'Last date quick suggestions quota was reset';
