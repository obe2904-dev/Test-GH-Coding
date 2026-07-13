-- Migration 013: Add CTA and Menu fields for Business Profile enhancements
-- Creates missing tables and adds support for booking links, CTA preferences, and menu descriptions

-- Create business_profile table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.business_profile (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  short_description TEXT,
  long_description TEXT,
  price_level TEXT CHECK (price_level IN ('low', 'medium', 'high')),
  target_audience TEXT,
  founded_year INTEGER CHECK (founded_year >= 1800 AND founded_year <= EXTRACT(YEAR FROM NOW())),
  menu_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create business_brand_profile table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.business_brand_profile (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  tone_keywords TEXT[],
  voice_style TEXT,
  values TEXT[],
  certifications TEXT[],
  do_not_say JSONB,
  booking_link TEXT,
  cta_preference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create opening_hours table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.opening_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  weekday TEXT NOT NULL CHECK (weekday IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  open_time TIME,
  close_time TIME,
  closed BOOLEAN DEFAULT FALSE,
  kind TEXT DEFAULT 'normal' CHECK (kind IN ('normal', 'kitchen', 'holiday')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns if they don't exist (for databases that already have the tables)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_brand_profile') THEN
    ALTER TABLE public.business_brand_profile
    ADD COLUMN IF NOT EXISTS booking_link TEXT,
    ADD COLUMN IF NOT EXISTS cta_preference TEXT;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_profile') THEN
    ALTER TABLE public.business_profile
    ADD COLUMN IF NOT EXISTS menu_description TEXT;
  END IF;
END $$;

-- Update comments
COMMENT ON TABLE public.business_profile IS 'Business descriptions and target audience';
COMMENT ON TABLE public.business_brand_profile IS 'Brand voice, tone, and communication preferences';
COMMENT ON TABLE public.opening_hours IS 'Weekly opening hours schedule';
COMMENT ON COLUMN public.business_brand_profile.booking_link IS 'URL for booking/reservation system';
COMMENT ON COLUMN public.business_brand_profile.cta_preference IS 'Preferred call-to-action text/style';
COMMENT ON COLUMN public.business_profile.menu_description IS 'Quick overview of menu/offerings for AI context';
