-- ⚠️ RUN THIS IN SUPABASE SQL EDITOR
-- Dashboard > SQL Editor > New Query > Paste and Run

-- Add plan/tier column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'standardplus', 'premium'));

-- Add usage quota tracking columns
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_generations_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_generations_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pdf_uploads_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pdf_uploads_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS website_analysis_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS website_analysis_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS scheduled_posts_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_daily_reset DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS last_monthly_reset DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE);

-- Create index for faster plan lookups
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON public.profiles(plan);

-- Create function to increment AI generation quota
CREATE OR REPLACE FUNCTION public.increment_ai_generation(user_id UUID)
RETURNS void AS $$
BEGIN
  -- Increment counters
  UPDATE public.profiles
  SET 
    ai_generations_today = ai_generations_today + 1,
    ai_generations_this_month = ai_generations_this_month + 1
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_ai_generation(UUID) TO authenticated;

-- ✅ Done! Now deploy the Edge Functions.
