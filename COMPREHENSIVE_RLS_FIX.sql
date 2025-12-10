-- ==========================================
-- COMPREHENSIVE FIX FOR ONBOARDING AND RLS
-- ==========================================
-- This fixes:
-- 1. The 400 error on create_business_onboarding
-- 2. The 500 error when querying businesses table
-- 3. RLS policies that are too restrictive
-- ==========================================

-- First, let's check what RLS policies exist
-- Run this to see current policies:
-- SELECT schemaname, tablename, policyname 
-- FROM pg_policies 
-- WHERE tablename IN ('businesses', 'business_locations', 'business_profile');

-- ==========================================
-- FIX 1: Ensure RLS is properly configured on businesses table
-- ==========================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Owners can view own business" ON public.businesses;
DROP POLICY IF EXISTS "Team members can view their business" ON public.businesses;
DROP POLICY IF EXISTS "Users can create own business" ON public.businesses;
DROP POLICY IF EXISTS "Owners can update own business" ON public.businesses;
DROP POLICY IF EXISTS "Owners can delete own business" ON public.businesses;

-- Create more permissive SELECT policy for authenticated users
CREATE POLICY "Users can view their business"
  ON public.businesses FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.business_team_members
      WHERE business_id = businesses.id
      AND user_id = auth.uid()
      AND accepted_at IS NOT NULL
    )
  );

-- Allow authenticated users to insert their own business
CREATE POLICY "Users can create own business"
  ON public.businesses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Allow owners to update their own business
CREATE POLICY "Owners can update own business"
  ON public.businesses FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Allow owners to delete their own business
CREATE POLICY "Owners can delete own business"
  ON public.businesses FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- ==========================================
-- FIX 2: Ensure business_locations RLS is permissive
-- ==========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view business locations" ON public.business_locations;
DROP POLICY IF EXISTS "Owners can manage business locations" ON public.business_locations;

-- Recreate with better policies
CREATE POLICY "Users can view their business locations"
  ON public.business_locations FOR SELECT
  TO authenticated
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

CREATE POLICY "Users can manage their business locations"
  ON public.business_locations FOR ALL
  TO authenticated
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

-- ==========================================
-- FIX 3: Fix the onboarding function
-- ==========================================

DROP FUNCTION IF EXISTS public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]);

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
SET search_path = public
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  -- Security check: only allow users to create their own business
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot create business for another user';
  END IF;

  -- Check if user already has a business
  SELECT id INTO v_business_id
  FROM public.businesses
  WHERE owner_id = p_user_id
  LIMIT 1;

  -- If business exists, return existing ID
  IF v_business_id IS NOT NULL THEN
    RETURN v_business_id;
  END IF;

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

  -- Update profiles table
  UPDATE public.profiles
  SET
    selected_platforms = p_selected_platforms,
    onboarding_completed = TRUE,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_business_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;

-- ==========================================
-- FIX 4: Ensure profiles table has proper RLS for updates
-- ==========================================

-- Check if profiles has RLS enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to update their own profile
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Allow users to view their own profile
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
      ON public.profiles FOR SELECT
      TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================
-- Run these after applying the fix to verify:

-- 1. Check RLS policies
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies 
-- WHERE tablename IN ('businesses', 'business_locations', 'profiles')
-- ORDER BY tablename, policyname;

-- 2. Check if function exists
-- SELECT proname, proargnames 
-- FROM pg_proc 
-- WHERE proname = 'create_business_onboarding';

-- 3. Test as a user (replace UUID with your test user ID)
-- SELECT public.create_business_onboarding(
--   'YOUR-USER-ID'::UUID,
--   'Test Business',
--   'café',
--   '2200',
--   'København',
--   'Danmark',
--   ARRAY['facebook', 'instagram']
-- );

-- ==========================================
-- COMPLETE
-- ==========================================
-- After running this:
-- 1. Refresh your browser
-- 2. Try onboarding again
-- 3. Should now work without 400 or 500 errors
-- ==========================================
