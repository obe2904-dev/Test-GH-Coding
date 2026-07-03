-- ==========================================
-- FIX ONBOARDING FUNCTION RLS ISSUE
-- ==========================================
-- The create_business_onboarding function fails because it's marked
-- as SECURITY DEFINER but still needs proper RLS handling
-- ==========================================

-- Recreate the function with proper security context
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
  -- Verify the calling user matches the user_id parameter (security check)
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: user_id mismatch';
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;

-- ==========================================
-- VERIFICATION
-- ==========================================
-- Test the function with a new user account:
-- 1. Sign up for a new account
-- 2. Complete onboarding
-- 3. Should create business + location records
-- 4. Should redirect to /dashboard/create
-- ==========================================
