-- Migration: Add business profile fields to profiles table
-- This stores the analyzed website data and business information

-- Add business profile fields to existing profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_name TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Danmark',
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS business_email TEXT,
ADD COLUMN IF NOT EXISTS about_text TEXT,
ADD COLUMN IF NOT EXISTS business_category TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{
  "man": {"open": "", "close": ""},
  "tir": {"open": "", "close": ""},
  "ons": {"open": "", "close": ""},
  "tor": {"open": "", "close": ""},
  "fre": {"open": "", "close": ""},
  "lør": {"open": "", "close": ""},
  "søn": {"open": "", "close": ""}
}'::jsonb,
ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS has_booking_button BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false;

-- Add comment to explain the schema
COMMENT ON COLUMN public.profiles.opening_hours IS 'JSON object with Danish day names (man, tir, ons, tor, fre, lør, søn) each containing open and close times';
COMMENT ON COLUMN public.profiles.keywords IS 'Array of keywords describing the business (e.g., brunch, kaffe, herreklip)';

-- Create index for faster website URL lookups
CREATE INDEX IF NOT EXISTS idx_profiles_website_url ON public.profiles(website_url);
CREATE INDEX IF NOT EXISTS idx_profiles_business_name ON public.profiles(business_name);
