-- Migration: Onboarding Redesign
-- Adds website_url parameter to create_business_onboarding function
-- Adds CHECK constraint for vertical values
-- Date: 2026-02-18

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 1: Normalize existing data and add CHECK constraint for businesses.vertical
-- ═══════════════════════════════════════════════════════════════════════════

-- First, normalize existing vertical values to remove accents and standardize
UPDATE public.businesses
SET vertical = CASE
  WHEN vertical ILIKE 'café' OR vertical ILIKE 'cafe' THEN 'cafe'
  WHEN vertical ILIKE 'restaurant' THEN 'restaurant'
  WHEN vertical ILIKE 'bar' THEN 'bar'
  WHEN vertical ILIKE 'bakery' OR vertical ILIKE 'bageri' THEN 'bakery'
  WHEN vertical ILIKE 'food_truck' OR vertical ILIKE 'food truck' THEN 'food_truck'
  WHEN vertical ILIKE 'hair_salon' OR vertical ILIKE 'hair salon' OR vertical ILIKE 'frisør' THEN 'hair_salon'
  WHEN vertical ILIKE 'barber' OR vertical ILIKE 'barbershop' THEN 'barber'
  WHEN vertical ILIKE 'nail_salon' OR vertical ILIKE 'nail salon' THEN 'nail_salon'
  WHEN vertical ILIKE 'spa' THEN 'spa'
  WHEN vertical ILIKE 'beauty_clinic' OR vertical ILIKE 'beauty clinic' THEN 'beauty_clinic'
  WHEN vertical ILIKE 'gym' OR vertical ILIKE 'fitness' THEN 'gym'
  WHEN vertical ILIKE 'yoga_studio' OR vertical ILIKE 'yoga studio' THEN 'yoga_studio'
  WHEN vertical ILIKE 'personal_trainer' OR vertical ILIKE 'personal trainer' THEN 'personal_trainer'
  WHEN vertical ILIKE 'crossfit' THEN 'crossfit'
  WHEN vertical ILIKE 'boutique' THEN 'boutique'
  WHEN vertical ILIKE 'gift_shop' OR vertical ILIKE 'gift shop' THEN 'gift_shop'
  WHEN vertical ILIKE 'bookstore' OR vertical ILIKE 'boghandel' THEN 'bookstore'
  WHEN vertical ILIKE 'flower_shop' OR vertical ILIKE 'flower shop' OR vertical ILIKE 'blomsterhandel' THEN 'flower_shop'
  WHEN vertical ILIKE 'dental_clinic' OR vertical ILIKE 'dental clinic' OR vertical ILIKE 'tandlæge' THEN 'dental_clinic'
  WHEN vertical ILIKE 'vet_clinic' OR vertical ILIKE 'vet clinic' OR vertical ILIKE 'dyrlæge' THEN 'vet_clinic'
  WHEN vertical ILIKE 'law_firm' OR vertical ILIKE 'law firm' OR vertical ILIKE 'advokatfirma' THEN 'law_firm'
  WHEN vertical ILIKE 'accounting' OR vertical ILIKE 'revisor' THEN 'accounting'
  ELSE 'cafe' -- Default fallback for unknown values
END
WHERE vertical IS NOT NULL;

-- Drop existing constraint if it exists
ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_vertical_check;

-- Add CHECK constraint to ensure vertical uses standardized values
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_vertical_check
  CHECK (vertical IN (
    -- Food & Drink
    'cafe', 'restaurant', 'bar', 'bakery', 'food_truck',
    -- Beauty & Wellness
    'hair_salon', 'barber', 'nail_salon', 'spa', 'beauty_clinic',
    -- Fitness & Sports
    'gym', 'yoga_studio', 'personal_trainer', 'crossfit',
    -- Retail
    'boutique', 'gift_shop', 'bookstore', 'flower_shop',
    -- Professional Services
    'dental_clinic', 'vet_clinic', 'law_firm', 'accounting'
  ));

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 2: Update create_business_onboarding function to include website_url
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_business_onboarding(
  p_user_id UUID,
  p_business_name TEXT,
  p_business_vertical TEXT,
  p_postal_code TEXT,
  p_city TEXT,
  p_country TEXT,
  p_selected_platforms TEXT[],
  p_website_url TEXT DEFAULT NULL  -- NEW: Optional website URL from onboarding
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  -- Create business record with optional website_url
  INSERT INTO public.businesses (
    owner_id,
    name,
    vertical,
    website_url,  -- NEW: Store website URL if provided
    primary_language,
    plan,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_business_name,
    p_business_vertical,
    p_website_url,  -- NEW: Can be NULL for manual onboarding
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
  -- (Keep profiles table for auth metadata until full migration)
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
GRANT EXECUTE ON FUNCTION public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- NOTES:
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. This migration is backward compatible:
--    - p_website_url has DEFAULT NULL, so existing calls work without changes
--    - Old 7-parameter calls will continue to work (website_url will be NULL)
--    - New 8-parameter calls can include website_url
--
-- 2. The vertical CHECK constraint enforces standardized values from
--    businessVerticals.ts to prevent data inconsistency
--
-- 3. The function signature now matches the redesigned onboarding flow:
--    - Step 1: Collect business name + optional website URL
--    - Step 2: Analyze website OR manual selection
--    - Step 3: Select platforms
--    - Submit: Call create_business_onboarding with all data including website_url
