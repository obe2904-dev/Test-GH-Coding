-- Migration: Add selected_platforms field to profiles table
-- This stores the platforms selected during onboarding (e.g., ['facebook', 'instagram'])

-- Add column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS selected_platforms JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.selected_platforms IS 'Array of platform names selected by user (e.g., ["facebook", "instagram"])';

-- Update the onboarding function to also save platforms
CREATE OR REPLACE FUNCTION public.update_profile_onboarding(
  p_user_id UUID,
  p_business_name TEXT,
  p_business_category TEXT,
  p_address TEXT,
  p_selected_platforms JSONB DEFAULT '[]'::jsonb
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
    selected_platforms = p_selected_platforms,
    onboarding_completed = true,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_profile_onboarding(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
