-- Migration: Add tier and usage quota columns to profiles table
-- Run: npx supabase db push (or apply in Supabase SQL Editor)

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

-- Create function to reset daily quotas
CREATE OR REPLACE FUNCTION public.reset_daily_quotas()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET 
    ai_generations_today = 0,
    pdf_uploads_today = 0,
    website_analysis_today = 0,
    last_daily_reset = CURRENT_DATE
  WHERE last_daily_reset < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to reset monthly quotas
CREATE OR REPLACE FUNCTION public.reset_monthly_quotas()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET 
    ai_generations_this_month = 0,
    pdf_uploads_this_month = 0,
    website_analysis_this_month = 0,
    scheduled_posts_this_month = 0,
    last_monthly_reset = DATE_TRUNC('month', CURRENT_DATE)
  WHERE last_monthly_reset < DATE_TRUNC('month', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to increment AI generation quota
CREATE OR REPLACE FUNCTION public.increment_ai_generation(user_id UUID)
RETURNS void AS $$
BEGIN
  -- Reset if needed
  PERFORM reset_daily_quotas();
  PERFORM reset_monthly_quotas();
  
  -- Increment counters
  UPDATE public.profiles
  SET 
    ai_generations_today = ai_generations_today + 1,
    ai_generations_this_month = ai_generations_this_month + 1
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check quota before action
CREATE OR REPLACE FUNCTION public.check_ai_generation_quota(user_id UUID)
RETURNS TABLE(
  allowed BOOLEAN,
  current_daily INTEGER,
  current_monthly INTEGER,
  tier TEXT
) AS $$
DECLARE
  user_plan TEXT;
  daily_count INTEGER;
  monthly_count INTEGER;
BEGIN
  -- Get user's current usage and plan
  SELECT plan, ai_generations_today, ai_generations_this_month
  INTO user_plan, daily_count, monthly_count
  FROM public.profiles
  WHERE id = user_id;
  
  -- Return quota check result
  -- (Limits enforced in Edge Functions using quotas.ts)
  RETURN QUERY SELECT 
    TRUE as allowed,  -- Edge Functions will enforce actual limits
    daily_count as current_daily,
    monthly_count as current_monthly,
    user_plan as tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.reset_daily_quotas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_monthly_quotas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_generation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_generation_quota(UUID) TO authenticated;

-- Comment the table additions
COMMENT ON COLUMN public.profiles.plan IS 'User tier: free, standardplus (Smart), or premium (Pro)';
COMMENT ON COLUMN public.profiles.ai_generations_today IS 'Count of AI generations used today';
COMMENT ON COLUMN public.profiles.ai_generations_this_month IS 'Count of AI generations used this month';
COMMENT ON COLUMN public.profiles.last_daily_reset IS 'Date when daily quotas were last reset';
COMMENT ON COLUMN public.profiles.last_monthly_reset IS 'Date when monthly quotas were last reset';
