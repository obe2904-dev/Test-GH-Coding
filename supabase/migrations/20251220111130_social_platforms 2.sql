-- Migration: Add social_platforms field to profiles table
-- This stores which social media platforms the user has enabled

-- Add social_platforms field to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS social_platforms TEXT[] DEFAULT '{}';

-- Add comment to explain the schema
COMMENT ON COLUMN public.profiles.social_platforms IS 'Array of enabled social media platforms (e.g., facebook, instagram)';

-- Create index for faster platform queries
CREATE INDEX IF NOT EXISTS idx_profiles_social_platforms ON public.profiles USING GIN(social_platforms);
