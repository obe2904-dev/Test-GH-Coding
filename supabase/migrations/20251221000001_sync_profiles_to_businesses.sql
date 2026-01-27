-- Migration: Sync Existing Data from Profiles to Businesses Schema
-- This ensures data consistency during the schema transition

-- ===============================
-- STEP 1: Sync businesses table
-- ===============================

-- Create businesses from profiles where they don't exist
INSERT INTO public.businesses (owner_id, name, vertical, website_url, primary_language, created_at, updated_at)
SELECT 
  p.id as owner_id,
  COALESCE(p.business_name, 'My Business') as name,
  COALESCE(p.business_type, 'cafe') as vertical,
  p.website_url,
  'da' as primary_language,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE p.business_name IS NOT NULL
  AND p.onboarding_completed = true
  AND NOT EXISTS (
    SELECT 1 FROM public.businesses b WHERE b.owner_id = p.id
  );

-- ===============================
-- STEP 2: Sync business_locations
-- ===============================

-- Create locations from profiles for existing businesses
INSERT INTO public.business_locations (business_id, postal_code, city, country, phone, email, is_primary, created_at)
SELECT 
  b.id as business_id,
  NULL as postal_code, -- profiles.address doesn't have structured postal_code
  NULL as city,
  COALESCE(p.country, 'Danmark') as country,
  p.phone,
  p.business_email,
  true as is_primary,
  NOW()
FROM public.profiles p
JOIN public.businesses b ON b.owner_id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.business_locations bl 
  WHERE bl.business_id = b.id
)
AND (p.phone IS NOT NULL OR p.business_email IS NOT NULL);

-- ===============================
-- STEP 3: Sync business_profile
-- ===============================

-- Create business profile from profiles data
INSERT INTO public.business_profile (business_id, long_description, created_at, updated_at)
SELECT 
  b.id as business_id,
  p.about_text as long_description,
  NOW(),
  NOW()
FROM public.profiles p
JOIN public.businesses b ON b.owner_id = p.id
WHERE p.about_text IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.business_profile bp WHERE bp.business_id = b.id
  );

-- ===============================
-- STEP 4: Sync opening_hours
-- ===============================

-- Convert JSONB opening_hours to opening_hours table
-- This is more complex due to the schema change from JSONB to rows

DO $$
DECLARE
  profile_rec RECORD;
  business_rec RECORD;
  hours_json JSONB;
  day_name TEXT;
  day_data JSONB;
  weekday_name TEXT;
BEGIN
  -- Map Danish day names to English weekday names
  FOR profile_rec IN 
    SELECT p.id, p.opening_hours, b.id as business_id
    FROM public.profiles p
    JOIN public.businesses b ON b.owner_id = p.id
    WHERE p.opening_hours IS NOT NULL
  LOOP
    hours_json := profile_rec.opening_hours;
    
    -- Danish to English day mapping
    FOR day_name, day_data IN SELECT * FROM jsonb_each(hours_json)
    LOOP
      weekday_name := CASE day_name
        WHEN 'man' THEN 'monday'
        WHEN 'tir' THEN 'tuesday'
        WHEN 'ons' THEN 'wednesday'
        WHEN 'tor' THEN 'thursday'
        WHEN 'fre' THEN 'friday'
        WHEN 'lør' THEN 'saturday'
        WHEN 'søn' THEN 'sunday'
        ELSE NULL
      END;
      
      IF weekday_name IS NOT NULL THEN
        -- Check if this business already has opening hours
        IF NOT EXISTS (
          SELECT 1 FROM public.opening_hours 
          WHERE business_id = profile_rec.business_id 
          AND weekday = weekday_name::TEXT
        ) THEN
          -- Insert opening hours row
          INSERT INTO public.opening_hours (business_id, weekday, open_time, close_time, closed)
          VALUES (
            profile_rec.business_id,
            weekday_name::TEXT,
            CASE 
              WHEN day_data->>'open' = '' THEN NULL
              ELSE (day_data->>'open')::TIME
            END,
            CASE 
              WHEN day_data->>'close' = '' THEN NULL
              ELSE (day_data->>'close')::TIME
            END,
            COALESCE((day_data->>'closed')::BOOLEAN, false)
          );
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ===============================
-- STEP 5: Update plan column
-- ===============================

-- Ensure all businesses have a plan (default to 'free')
UPDATE public.businesses
SET plan = 'free'
WHERE plan IS NULL;

-- ===============================
-- VERIFICATION QUERIES
-- ===============================

-- Check sync results:
-- SELECT COUNT(*) FROM businesses; -- Should match profiles with business_name
-- SELECT COUNT(*) FROM business_locations; -- Should have locations
-- SELECT COUNT(*) FROM opening_hours; -- Should have opening hours

-- Check specific business:
-- SELECT b.*, bl.*, bp.* 
-- FROM businesses b
-- LEFT JOIN business_locations bl ON bl.business_id = b.id
-- LEFT JOIN business_profile bp ON bp.business_id = b.id
-- WHERE b.owner_id = 'YOUR_USER_ID';
