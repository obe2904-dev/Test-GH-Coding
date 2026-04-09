-- Quick fix script for selected_platforms type issue
-- Run this in Supabase SQL Editor

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
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT id INTO v_business_id FROM public.businesses WHERE owner_id = p_user_id LIMIT 1;

  IF v_business_id IS NOT NULL THEN
    UPDATE public.profiles SET selected_platforms = to_jsonb(p_selected_platforms), onboarding_completed = TRUE, updated_at = NOW() WHERE id = p_user_id;
    RETURN v_business_id;
  END IF;

  INSERT INTO public.businesses (owner_id, name, vertical, primary_language, plan, created_at, updated_at)
  VALUES (p_user_id, p_business_name, p_business_vertical, 'da', 'free', NOW(), NOW())
  RETURNING id INTO v_business_id;

  INSERT INTO public.business_locations (business_id, postal_code, city, country, is_primary, created_at)
  VALUES (v_business_id, p_postal_code, p_city, p_country, TRUE, NOW());

  UPDATE public.profiles
  SET business_name = p_business_name, business_category = p_business_vertical, selected_platforms = to_jsonb(p_selected_platforms), country = p_country, onboarding_completed = TRUE, updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_business_id;
END;
$$;
