-- Add booking_url column to business_profile for CTA links
-- This stores the detected booking/reservation URL from website analysis

DO $$
BEGIN
  -- Check if the table exists first
  IF to_regclass('public.business_profile') IS NULL THEN
    RAISE NOTICE 'Skipping: table public.business_profile does not exist yet';
    RETURN;
  END IF;

  -- Add booking_url column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'business_profile' AND column_name = 'booking_url') THEN
    ALTER TABLE public.business_profile ADD COLUMN booking_url TEXT;
    COMMENT ON COLUMN public.business_profile.booking_url IS 'Booking/reservation URL for CTA buttons (e.g., DinnerBooking, OpenTable links)';
    RAISE NOTICE 'Added booking_url column to business_profile';
  ELSE
    RAISE NOTICE 'Column booking_url already exists in business_profile';
  END IF;
END $$;
