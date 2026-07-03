-- Migrate existing profile data to businesses and business_locations tables
-- This ensures compatibility with the new data structure

-- First, ensure the businesses table has the plan column (run FIX_BUSINESSES_PLAN_COLUMN.sql first if needed)

-- Migrate profiles to businesses table
INSERT INTO public.businesses (
  id,
  owner_id,
  name,
  vertical,
  primary_language,
  plan,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid() as id,
  p.id as owner_id,
  COALESCE(p.business_name, 'My Business') as name,
  COALESCE(p.business_category, 'café') as vertical,
  'da' as primary_language,
  COALESCE(p.plan, 'free') as plan,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE p.onboarding_completed = true
  AND NOT EXISTS (
    SELECT 1 FROM public.businesses b 
    WHERE b.owner_id = p.id
  );

-- Migrate location data to business_locations
INSERT INTO public.business_locations (
  id,
  business_id,
  postal_code,
  city,
  country,
  address,
  is_primary,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid() as id,
  b.id as business_id,
  COALESCE(NULLIF(SPLIT_PART(p.address, ',', 1), ''), '0000') as postal_code,
  COALESCE(NULLIF(SPLIT_PART(p.address, ',', 2), ''), 'Unknown') as city,
  COALESCE(p.country, 'Danmark') as country,
  p.address as address,
  true as is_primary,
  NOW() as created_at,
  NOW() as updated_at
FROM public.profiles p
JOIN public.businesses b ON b.owner_id = p.id
WHERE p.onboarding_completed = true
  AND NOT EXISTS (
    SELECT 1 FROM public.business_locations bl 
    WHERE bl.business_id = b.id
  );

-- Verify the migration
SELECT 
  'Profiles with onboarding completed' as check_type,
  COUNT(*) as count
FROM public.profiles 
WHERE onboarding_completed = true

UNION ALL

SELECT 
  'Businesses created' as check_type,
  COUNT(*) as count
FROM public.businesses

UNION ALL

SELECT 
  'Business locations created' as check_type,
  COUNT(*) as count
FROM public.business_locations;
