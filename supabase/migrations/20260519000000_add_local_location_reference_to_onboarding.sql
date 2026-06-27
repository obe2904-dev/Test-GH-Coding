-- ============================================================================
-- MINIMAL ONBOARDING FUNCTION
-- ============================================================================
-- Simplified onboarding that only collects:
-- - User ID (from auth)
-- - Business name (optional, defaults to "My Business")
-- - Selected platforms (optional, defaults to facebook)
-- Location and other details can be added later via settings
-- ============================================================================

-- Drop all previous versions of the function
DROP FUNCTION IF EXISTS public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[]);
DROP FUNCTION IF EXISTS public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT);
DROP FUNCTION IF EXISTS public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_business_onboarding(UUID, TEXT, TEXT[]);

-- Create minimal onboarding function
CREATE OR REPLACE FUNCTION public.create_business_onboarding(
  p_user_id UUID,
  p_business_name TEXT,
  p_selected_platforms TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  -- Create business record with minimal fields
  INSERT INTO public.businesses (
    owner_id,
    name,
    primary_language,
    plan,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    COALESCE(NULLIF(p_business_name, ''), 'My Business'),
    'da', -- Danish default
    'free', -- Free tier by default
    NOW(),
    NOW()
  )
  RETURNING id INTO v_business_id;

  -- Store selected platforms in profiles
  UPDATE public.profiles
  SET
    selected_platforms = to_jsonb(COALESCE(NULLIF(p_selected_platforms, ARRAY[]::TEXT[]), ARRAY['facebook'])),
    onboarding_completed = TRUE,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_business_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_business_onboarding(UUID, TEXT, TEXT[]) TO authenticated;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Onboarding collects only name/email (from auth) + optional business name + optional platforms
-- 2. Location fields (postal code, city, country) removed - can be added later
-- 3. Business classification and enrichment happen after onboarding
-- ============================================================================
