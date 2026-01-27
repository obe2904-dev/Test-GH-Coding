-- Make create_business_onboarding function idempotent
-- Prevents creating duplicate businesses if function is called twice

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
  v_existing_business_id UUID;
  v_sector TEXT;
BEGIN
  -- Check if user already has a business
  SELECT id INTO v_existing_business_id
  FROM public.businesses
  WHERE owner_id = p_user_id
  LIMIT 1;
  
  -- If business already exists, return existing ID instead of creating duplicate
  IF v_existing_business_id IS NOT NULL THEN
    RAISE NOTICE 'User % already has business %, returning existing ID', p_user_id, v_existing_business_id;
    RETURN v_existing_business_id;
  END IF;
  
  -- Map specific business type to broader sector
  -- Store specific type in category, broader sector in vertical
  v_sector := CASE
    WHEN p_business_vertical IN ('café', 'restaurant', 'bar', 'bistro', 'pizzaria') THEN 'hospitality'
    WHEN p_business_vertical IN ('frisør', 'barbershop', 'skønhedsklinik', 'spa', 'negledesign') THEN 'beauty'
    WHEN p_business_vertical IN ('fitness', 'yoga', 'massage', 'fysioterapi') THEN 'wellness'
    WHEN p_business_vertical IN ('tøjbutik', 'smykkebutik', 'boghandel') THEN 'retail'
    ELSE 'hospitality' -- Default fallback
  END;
  
  -- Create business record
  INSERT INTO public.businesses (
    owner_id,
    name,
    vertical,
    category,
    primary_language,
    plan,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_business_name,
    v_sector,
    p_business_vertical,
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
GRANT EXECUTE ON FUNCTION public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;

-- Test the idempotency
-- Run this after applying the migration to verify it works:
-- 
-- SELECT create_business_onboarding(
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   'Test Business',
--   'café',
--   '5000',
--   'Odense C',
--   'Danmark',
--   ARRAY['facebook']::text[]
-- );
-- 
-- Running this twice should return the same business_id without creating duplicates
