-- ==========================================
-- APPLY THESE MIGRATIONS IN SUPABASE SQL EDITOR
-- ==========================================
-- Run these migrations to:
-- 1. Create missing business_team_members table (if needed)
-- 2. Move tier/plan from user to business level
-- 3. Add RLS policies for team member access
-- ==========================================

-- ==========================================
-- STEP 0: Create missing business tables if needed
-- ==========================================

-- BUSINESS TEAM MEMBERS
CREATE TABLE IF NOT EXISTS public.business_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(business_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_business_team_members_business_id ON public.business_team_members(business_id);
CREATE INDEX IF NOT EXISTS idx_business_team_members_user_id ON public.business_team_members(user_id);

-- BUSINESS PROFILE
CREATE TABLE IF NOT EXISTS public.business_profile (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  short_description TEXT,
  long_description TEXT,
  price_level TEXT CHECK (price_level IN ('low', 'medium', 'high')),
  target_audience TEXT,
  founded_year INTEGER CHECK (founded_year >= 1800 AND founded_year <= EXTRACT(YEAR FROM NOW())),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BUSINESS LOCATIONS
CREATE TABLE IF NOT EXISTS public.business_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  label TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'Denmark',
  maps_url TEXT,
  phone TEXT,
  email TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- MIGRATION 010: Move tier to business level
-- ==========================================

-- Add plan column to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'standardplus', 'premium'));

-- Add usage quota tracking at business level
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

-- Create index for faster plan lookups
CREATE INDEX IF NOT EXISTS idx_businesses_plan ON public.businesses(plan);

-- Create function to get user's business tier
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

-- Create function to get user's business ID
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

-- Update quota functions to work at business level
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

-- Create function to check quota at business level
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


-- ==========================================
-- MIGRATION 011: RLS Policies for Team Members
-- ==========================================

-- BUSINESSES TABLE
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own business" ON public.businesses;
CREATE POLICY "Owners can view own business"
  ON public.businesses FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Team members can view their business" ON public.businesses;
CREATE POLICY "Team members can view their business"
  ON public.businesses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_team_members
      WHERE business_id = businesses.id
      AND user_id = auth.uid()
      AND accepted_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can create own business" ON public.businesses;
CREATE POLICY "Users can create own business"
  ON public.businesses FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update own business" ON public.businesses;
CREATE POLICY "Owners can update own business"
  ON public.businesses FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete own business" ON public.businesses;
CREATE POLICY "Owners can delete own business"
  ON public.businesses FOR DELETE
  USING (auth.uid() = owner_id);

-- BUSINESS PROFILE TABLE
ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view business profile" ON public.business_profile;
CREATE POLICY "Users can view business profile"
  ON public.business_profile FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_profile.business_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.business_team_members btm
          WHERE btm.business_id = b.id
          AND btm.user_id = auth.uid()
          AND btm.accepted_at IS NOT NULL
        )
      )
    )
  );

DROP POLICY IF EXISTS "Owners can update business profile" ON public.business_profile;
CREATE POLICY "Owners can update business profile"
  ON public.business_profile FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_profile.business_id
      AND b.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create business profile" ON public.business_profile;
CREATE POLICY "Users can create business profile"
  ON public.business_profile FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_profile.business_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.business_team_members btm
          WHERE btm.business_id = b.id
          AND btm.user_id = auth.uid()
          AND btm.accepted_at IS NOT NULL
        )
      )
    )
  );

DROP POLICY IF EXISTS "Owners can delete business profile" ON public.business_profile;
CREATE POLICY "Owners can delete business profile"
  ON public.business_profile FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_profile.business_id
      AND b.owner_id = auth.uid()
    )
  );

-- BUSINESS LOCATIONS TABLE
ALTER TABLE public.business_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view business locations" ON public.business_locations;
CREATE POLICY "Users can view business locations"
  ON public.business_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_locations.business_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.business_team_members btm
          WHERE btm.business_id = b.id
          AND btm.user_id = auth.uid()
          AND btm.accepted_at IS NOT NULL
        )
      )
    )
  );

DROP POLICY IF EXISTS "Owners can manage business locations" ON public.business_locations;
CREATE POLICY "Owners can manage business locations"
  ON public.business_locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_locations.business_id
      AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_locations.business_id
      AND b.owner_id = auth.uid()
    )
  );

-- BUSINESS TEAM MEMBERS TABLE
ALTER TABLE public.business_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view team members" ON public.business_team_members;
CREATE POLICY "Owners can view team members"
  ON public.business_team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_team_members.business_id
      AND b.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Team members can view other members" ON public.business_team_members;
CREATE POLICY "Team members can view other members"
  ON public.business_team_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.business_team_members btm
      WHERE btm.business_id = business_team_members.business_id
      AND btm.user_id = auth.uid()
      AND btm.accepted_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Owners can add team members" ON public.business_team_members;
CREATE POLICY "Owners can add team members"
  ON public.business_team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_team_members.business_id
      AND b.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can remove team members" ON public.business_team_members;
CREATE POLICY "Owners can remove team members"
  ON public.business_team_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_team_members.business_id
      AND b.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can accept own invitation" ON public.business_team_members;
CREATE POLICY "Members can accept own invitation"
  ON public.business_team_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_business_owner(business_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = business_uuid
    AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_team_member(business_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.business_team_members
    WHERE business_id = business_uuid
    AND user_id = auth.uid()
    AND accepted_at IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_business_access(business_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    public.is_business_owner(business_uuid)
    OR public.is_team_member(business_uuid)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.is_business_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_business_access(UUID) TO authenticated;

-- ==========================================
-- MIGRATION 012: Business Onboarding Function
-- ==========================================

CREATE OR REPLACE FUNCTION public.create_business_onboarding(
  p_user_id UUID,
  p_business_name TEXT,
  p_business_vertical TEXT,
  p_postal_code TEXT,
  p_city TEXT,
  p_country TEXT,
  p_selected_platforms TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  -- Create business record
  INSERT INTO public.businesses (
    owner_id,
    name,
    vertical,
    primary_language,
    plan,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_business_name,
    p_business_vertical,
    'da',
    'free',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_business_id;

  -- Create business location record
  INSERT INTO public.business_locations (
    business_id,
    postal_code,
    city,
    country,
    is_primary,
    created_at
  )
  VALUES (
    v_business_id,
    p_postal_code,
    p_city,
    p_country,
    TRUE,
    NOW()
  );

  -- Store selected platforms in profiles for backward compatibility
  UPDATE public.profiles
  SET
    selected_platforms = p_selected_platforms,
    onboarding_completed = TRUE,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_business_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;

-- ==========================================
-- MIGRATIONS COMPLETE
-- ==========================================
-- What was applied:
-- 1. Created missing business tables (team_members, profile, locations)
-- 2. Added plan + quota columns to businesses table
-- 3. Created helper functions (get_user_business_tier, etc.)
-- 4. Set up RLS policies for team member access
-- 5. Created business onboarding function
--
-- Next steps:
-- 1. Test new user onboarding flow
-- 2. Verify tier fetching from businesses table
-- 3. Test team member functionality when UI is ready
-- ==========================================
