-- RUN THIS IN SUPABASE SQL EDITOR
-- This adds about_us_url and opening_hours_url columns to business_profile table

-- Add columns if they don't exist
DO $$ 
BEGIN
  -- Add about_us_url column
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_profile'
    AND column_name = 'about_us_url'
  ) THEN
    ALTER TABLE public.business_profile
    ADD COLUMN about_us_url TEXT;
    
    RAISE NOTICE 'Added about_us_url column';
  ELSE
    RAISE NOTICE 'about_us_url column already exists';
  END IF;

  -- Add opening_hours_url column
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_profile'
    AND column_name = 'opening_hours_url'
  ) THEN
    ALTER TABLE public.business_profile
    ADD COLUMN opening_hours_url TEXT;
    
    RAISE NOTICE 'Added opening_hours_url column';
  ELSE
    RAISE NOTICE 'opening_hours_url column already exists';
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN public.business_profile.about_us_url IS 
  'URL to the business About Us or About page for targeted content extraction';

COMMENT ON COLUMN public.business_profile.opening_hours_url IS 
  'URL to the business opening hours page for targeted content extraction';

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'business_profile'
AND column_name IN ('about_us_url', 'opening_hours_url')
ORDER BY ordinal_position;
