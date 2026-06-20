-- ============================================================================
-- ADD LOCAL_LOCATION_REFERENCE TO create_business_onboarding FUNCTION
-- ============================================================================
-- Adds optional local_location_reference parameter to onboarding function
-- Allows website analysis to auto-populate authentic local place names
-- ============================================================================

-- Update create_business_onboarding function to include local_location_reference
DROP FUNCTION IF EXISTS public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT);

CREATE OR REPLACE FUNCTION public.create_business_onboarding(
  p_user_id UUID,
  p_business_name TEXT,
  p_business_vertical TEXT,
  p_postal_code TEXT,
  p_city TEXT,
  p_country TEXT,
  p_selected_platforms TEXT[],
  p_website_url TEXT DEFAULT NULL,
  p_local_location_reference TEXT DEFAULT NULL  -- NEW: Optional local place name
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  -- Create business record with optional website_url and local_location_reference
  INSERT INTO public.businesses (
    owner_id,
    name,
    vertical,
    website_url,
    local_location_reference,  -- NEW: Store local place name if provided
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
    p_local_location_reference,  -- NEW: Can be NULL if not extracted/provided
    'da', -- Danish default
    'free', -- Free tier by default
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
    TRUE, -- First location is primary
    NOW()
  );

  -- Store selected platforms in profiles for backward compatibility
  UPDATE public.profiles
  SET
    selected_platforms = to_jsonb(p_selected_platforms),
    onboarding_completed = TRUE,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_business_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT) TO authenticated;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Backward compatible: p_local_location_reference has DEFAULT NULL
--    - Old 8-parameter calls will work (local_location_reference will be NULL)
--    - New 9-parameter calls can include local_location_reference
--
-- 2. Auto-population flow:
--    - OnboardingPage analyzes website → extractBasicInfo returns localLocationReference
--    - OnboardingPage passes it to create_business_onboarding
--    - Stored in businesses.local_location_reference
--    - Used by brand-profile-generator-v5 for all AI prompts
--
-- 3. Examples of extracted values:
--    - "ved åen" (from "Café beliggende ved åen i Aarhus")
--    - "Nyhavn" (from "Restaurant lige midt i Nyhavn")
--    - "i Vesterbro" (from "Bar i Vesterbro")
-- ============================================================================
