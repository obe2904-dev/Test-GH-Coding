-- Migration: Fix RLS Policies for Business Tables
-- Adds missing SELECT policies that are causing "permission denied" errors

-- ===============================
-- BUSINESS_LOCATIONS
-- ===============================

-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Users can view their business locations" ON public.business_locations;
CREATE POLICY "Users can view their business locations"
  ON public.business_locations
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Team members can view business locations" ON public.business_locations;
CREATE POLICY "Team members can view business locations"
  ON public.business_locations
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.business_team_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- ===============================
-- BUSINESS_PROFILE
-- ===============================

DROP POLICY IF EXISTS "Users can view their business profile" ON public.business_profile;
CREATE POLICY "Users can view their business profile"
  ON public.business_profile
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Team members can view business profile" ON public.business_profile;
CREATE POLICY "Team members can view business profile"
  ON public.business_profile
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.business_team_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can insert business profile" ON public.business_profile;
CREATE POLICY "Users can insert business profile"
  ON public.business_profile
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update business profile" ON public.business_profile;
CREATE POLICY "Users can update business profile"
  ON public.business_profile
  FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- ===============================
-- BUSINESS_BRAND_PROFILE
-- ===============================

DROP POLICY IF EXISTS "Users can view their brand profile" ON public.business_brand_profile;
CREATE POLICY "Users can view their brand profile"
  ON public.business_brand_profile
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Team members can view brand profile" ON public.business_brand_profile;
CREATE POLICY "Team members can view brand profile"
  ON public.business_brand_profile
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.business_team_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can insert brand profile" ON public.business_brand_profile;
CREATE POLICY "Users can insert brand profile"
  ON public.business_brand_profile
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update brand profile" ON public.business_brand_profile;
CREATE POLICY "Users can update brand profile"
  ON public.business_brand_profile
  FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- ===============================
-- OPENING_HOURS
-- ===============================

DROP POLICY IF EXISTS "Users can view their opening hours" ON public.opening_hours;
CREATE POLICY "Users can view their opening hours"
  ON public.opening_hours
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Team members can view opening hours" ON public.opening_hours;
CREATE POLICY "Team members can view opening hours"
  ON public.opening_hours
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.business_team_members 
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can insert opening hours" ON public.opening_hours;
CREATE POLICY "Users can insert opening hours"
  ON public.opening_hours
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update opening hours" ON public.opening_hours;
CREATE POLICY "Users can update opening hours"
  ON public.opening_hours
  FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete opening hours" ON public.opening_hours;
CREATE POLICY "Users can delete opening hours"
  ON public.opening_hours
  FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- ===============================
-- VERIFICATION
-- ===============================

-- To verify policies are working, run:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
