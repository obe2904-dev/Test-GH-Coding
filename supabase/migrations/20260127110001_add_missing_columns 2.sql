-- =====================================================
-- ADD MISSING COLUMNS FOR AI GENERATE V2
-- =====================================================
-- These columns are required by the frontend/Edge Functions but were missing

-- Add booking_url to business_profile table
ALTER TABLE public.business_profile
ADD COLUMN IF NOT EXISTS booking_url TEXT;

COMMENT ON COLUMN public.business_profile.booking_url IS 'Booking/reservation URL for the business';

-- Add business_offerings to profiles table (if not exists)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_offerings JSONB;

COMMENT ON COLUMN public.profiles.business_offerings IS 'Business offerings/products structured as categories and items (menu, treatments, products, etc.)';

-- Create index on booking_url for faster lookups
CREATE INDEX IF NOT EXISTS idx_business_profile_booking_url 
ON public.business_profile(business_id) 
WHERE booking_url IS NOT NULL;
