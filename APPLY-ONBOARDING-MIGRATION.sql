-- ============================================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================================
-- URL: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
-- ============================================================================
-- MINIMAL ONBOARDING: Only name/email (from auth) + optional business name + optional platforms
-- ============================================================================

-- Drop all previous function signatures
DROP FUNCTION IF EXISTS public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[]);
DROP FUNCTION IF EXISTS public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT);
DROP FUNCTION IF EXISTS public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_business_onboarding(UUID, TEXT, TEXT[]);

-- Create new minimal onboarding function
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_business_onboarding(UUID, TEXT, TEXT[]) TO authenticated;

-- Refresh schema cache
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

-- Expected output: p_user_id UUID, p_business_name TEXT, p_selected_platforms TEXT[]

-- ============================================================================
-- LOCATION INTELLIGENCE BUG - INVESTIGATION & FIXES
-- ============================================================================
-- Business: KOREAN BBQ & SUSHI (ID: 95d657ad-d791-422b-ad40-ec7a5f1c2b0c)
-- Location: Søndergade 20a, 8600 Silkeborg
-- Coordinates: 56.16744600, 9.55035480 (CORRECT)
-- 
-- ISSUES FOUND:
-- 1. neighborhood = "Aarhus" (WRONG - Aarhus is 45km from Silkeborg!)
-- 2. area_type = "student" (INVALID - not a geographic type)
-- 
-- ROOT CAUSES:
-- 1. "student" in area_type = Old schema bug (pre-May 2026 migration)
-- 2. Wrong neighborhood = Google Maps API returned incorrect data
-- 
-- PROPER FIXES:
-- → See _FIX_INVALID_AREA_TYPES.sql for database cleanup
-- → See _EDGE_FUNCTION_VALIDATION_PATCHES.md for code fixes
-- → See _LOCATION_INTELLIGENCE_BUG_ANALYSIS.md for full analysis
-- ============================================================================

-- Diagnostic Query: Check current state
SELECT 
  b.name,
  bl.city AS db_city,
  bl.postal_code,
  bli.neighborhood AS google_neighborhood,
  bli.area_type,
  bli.latitude,
  bli.longitude,
  CASE 
    WHEN bli.neighborhood NOT ILIKE '%' || bl.city || '%' 
     AND bl.city NOT ILIKE '%' || bli.neighborhood || '%'
    THEN '❌ MISMATCH'
    ELSE '✅ OK'
  END AS city_match_status,
  CASE 
    WHEN bli.area_type NOT IN ('city_centre', 'residential', 'office', 'transport_hub',
                               'waterfront', 'shopping_district', 'mixed_use', 'destination', 'nature_park')
    THEN '❌ INVALID'
    ELSE '✅ VALID'
  END AS area_type_status
FROM businesses b
JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
LEFT JOIN business_location_intelligence bli ON b.id = bli.business_id
WHERE b.id = '95d657ad-d791-422b-ad40-ec7a5f1c2b0c';
