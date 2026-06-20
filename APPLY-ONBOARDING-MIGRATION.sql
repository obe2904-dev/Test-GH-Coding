-- ============================================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================================
-- URL: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
-- ============================================================================

-- Drop old function signature
DROP FUNCTION IF EXISTS public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT);

-- Create new function with local_location_reference parameter
CREATE OR REPLACE FUNCTION public.create_business_onboarding(
  p_user_id UUID,
  p_business_name TEXT,
  p_business_vertical TEXT,
  p_postal_code TEXT,
  p_city TEXT,
  p_country TEXT,
  p_selected_platforms TEXT[],
  p_website_url TEXT DEFAULT NULL,
  p_local_location_reference TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  INSERT INTO public.businesses (
    owner_id,
    name,
    vertical,
    website_url,
    local_location_reference,
    primary_language,
    plan,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_business_name,
    p_business_vertical,
    p_website_url,
    p_local_location_reference,
    'da',
    'free',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_business_id;

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

  UPDATE public.profiles
  SET
    selected_platforms = to_jsonb(p_selected_platforms),
    onboarding_completed = TRUE,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_business_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT) TO authenticated;

-- Refresh schema
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check function signature
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'create_business_onboarding'
  AND pronamespace = 'public'::regnamespace;

-- Expected output should show 9 parameters including p_local_location_reference
