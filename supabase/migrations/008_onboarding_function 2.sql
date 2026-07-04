-- Migration: Add function for onboarding profile updates
-- This avoids TypeScript type issues with the Supabase client

CREATE OR REPLACE FUNCTION public.update_profile_onboarding(
  p_user_id UUID,
  p_business_name TEXT,
  p_business_category TEXT,
  p_address TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    business_name = p_business_name,
    business_category = p_business_category,
    address = p_address,
    onboarding_completed = true,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_profile_onboarding(UUID, TEXT, TEXT, TEXT) TO authenticated;
