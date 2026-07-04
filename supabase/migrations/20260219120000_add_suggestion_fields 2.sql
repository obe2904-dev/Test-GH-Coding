-- Add new fields to daily_suggestions table for enhanced AI suggestions
-- why_explanation: Expert explanation (2-3 sentences)
-- photo_idea: Concrete photo suggestion (1 sentence)

ALTER TABLE public.daily_suggestions 
ADD COLUMN IF NOT EXISTS why_explanation TEXT,
ADD COLUMN IF NOT EXISTS photo_idea TEXT;

-- Add comment
COMMENT ON COLUMN public.daily_suggestions.why_explanation IS 'Social Media Expert explanation (2-3 sentences) of why this post works';
COMMENT ON COLUMN public.daily_suggestions.photo_idea IS 'Concrete photo suggestion (1 sentence)';
