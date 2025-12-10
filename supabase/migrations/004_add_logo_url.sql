-- Migration: Add logo_url field to profiles table
-- This stores the business logo URL extracted from website or manually entered

-- Add logo_url field to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN public.profiles.logo_url IS 'URL to business logo image (extracted from website or manually entered)';
