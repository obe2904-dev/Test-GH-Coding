-- ============================================================================
-- FIX ONBOARDING FOR EXISTING BUSINESSES
-- ============================================================================
-- Problem: create_business_onboarding fails when user already has a business
-- Solution: Check for existing business first, return it if found
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_business_onboarding(UUID, TEXT, TEXT[]);

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
  v_existing_business_id UUID;
BEGIN
  -- Check if user already has a business
  SELECT id INTO v_existing_business_id
  FROM public.businesses
  WHERE owner_id = p_user_id
  LIMIT 1;

  -- If business exists, update platforms and return existing ID
  IF v_existing_business_id IS NOT NULL THEN
    -- Update platforms in profile
    UPDATE public.profiles
    SET
      selected_platforms = to_jsonb(COALESCE(NULLIF(p_selected_platforms, ARRAY[]::TEXT[]), ARRAY['facebook'])),
      onboarding_completed = TRUE,
      updated_at = NOW()
    WHERE id = p_user_id;

    -- Optionally update business name if provided and current name is default
    UPDATE public.businesses
    SET
      name = COALESCE(NULLIF(p_business_name, ''), name),
      updated_at = NOW()
    WHERE id = v_existing_business_id
      AND (name = 'My Business' OR name IS NULL);

    RETURN v_existing_business_id;
  END IF;

  -- No existing business, create new one
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

GRANT EXECUTE ON FUNCTION public.create_business_onboarding(UUID, TEXT, TEXT[]) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- This fixes the issue where users who started onboarding, created a partial
-- business record, then logged out and tried to log back in would get a
-- "duplicate key value violates unique constraint businesses_owner_id_key" error.
--
-- Now the function checks for existing businesses first and returns the existing
-- ID instead of trying to create a duplicate.
-- ============================================================================
