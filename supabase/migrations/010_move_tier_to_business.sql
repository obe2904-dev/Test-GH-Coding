-- Migration: Move tier/plan from user level to business level
-- Since this is pre-launch, we can safely restructure without data migration

-- Step 1: Add plan column to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'standardplus', 'premium'));

-- Step 2: Add usage quota tracking at business level (not user level)
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS ai_generations_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_generations_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pdf_uploads_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pdf_uploads_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS website_analysis_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS website_analysis_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS scheduled_posts_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_daily_reset DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS last_monthly_reset DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE);

-- Step 3: Create index for faster plan lookups
CREATE INDEX IF NOT EXISTS idx_businesses_plan ON public.businesses(plan);

-- Step 4: Remove plan/quota columns from profiles (they'll be deprecated)
-- Note: We keep them for backward compatibility during transition, but they're no longer the source of truth
-- After full migration, run: ALTER TABLE public.profiles DROP COLUMN plan;

-- Step 5: Create function to get user's business tier
CREATE OR REPLACE FUNCTION public.get_user_business_tier(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  business_tier TEXT;
BEGIN
  -- Get tier from user's business (as owner)
  SELECT plan INTO business_tier
  FROM public.businesses
  WHERE owner_id = user_id;
  
  -- If not owner, check if they're a team member
  IF business_tier IS NULL THEN
    SELECT b.plan INTO business_tier
    FROM public.businesses b
    JOIN public.business_team_members btm ON b.id = btm.business_id
    WHERE btm.user_id = user_id
    AND btm.accepted_at IS NOT NULL;
  END IF;
  
  -- Default to free if no business found
  RETURN COALESCE(business_tier, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create function to get user's business ID
CREATE OR REPLACE FUNCTION public.get_user_business_id(user_id UUID)
RETURNS UUID AS $$
DECLARE
  business_uuid UUID;
BEGIN
  -- Get business ID (as owner)
  SELECT id INTO business_uuid
  FROM public.businesses
  WHERE owner_id = user_id;
  
  -- If not owner, check if they're a team member
  IF business_uuid IS NULL THEN
    SELECT b.id INTO business_uuid
    FROM public.businesses b
    JOIN public.business_team_members btm ON b.id = btm.business_id
    WHERE btm.user_id = user_id
    AND btm.accepted_at IS NOT NULL;
  END IF;
  
  RETURN business_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Update quota functions to work at business level
CREATE OR REPLACE FUNCTION public.increment_ai_generation_business(business_uuid UUID)
RETURNS void AS $$
BEGIN
  -- Reset if needed (business-level)
  UPDATE public.businesses
  SET 
    ai_generations_today = 0,
    pdf_uploads_today = 0,
    website_analysis_today = 0,
    last_daily_reset = CURRENT_DATE
  WHERE id = business_uuid AND last_daily_reset < CURRENT_DATE;
  
  UPDATE public.businesses
  SET 
    ai_generations_this_month = 0,
    pdf_uploads_this_month = 0,
    website_analysis_this_month = 0,
    scheduled_posts_this_month = 0,
    last_monthly_reset = DATE_TRUNC('month', CURRENT_DATE)
  WHERE id = business_uuid AND last_monthly_reset < DATE_TRUNC('month', CURRENT_DATE);
  
  -- Increment counters
  UPDATE public.businesses
  SET 
    ai_generations_today = ai_generations_today + 1,
    ai_generations_this_month = ai_generations_this_month + 1
  WHERE id = business_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create function to check quota at business level
CREATE OR REPLACE FUNCTION public.check_ai_generation_quota_business(business_uuid UUID)
RETURNS TABLE(
  allowed BOOLEAN,
  current_daily INTEGER,
  current_monthly INTEGER,
  tier TEXT
) AS $$
DECLARE
  business_plan TEXT;
  daily_count INTEGER;
  monthly_count INTEGER;
BEGIN
  -- Get business usage and plan
  SELECT plan, ai_generations_today, ai_generations_this_month
  INTO business_plan, daily_count, monthly_count
  FROM public.businesses
  WHERE id = business_uuid;
  
  -- Return quota check result
  RETURN QUERY SELECT 
    TRUE as allowed,  -- Edge Functions will enforce actual limits
    daily_count as current_daily,
    monthly_count as current_monthly,
    COALESCE(business_plan, 'free') as tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_business_tier(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_business_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_generation_business(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_generation_quota_business(UUID) TO authenticated;
