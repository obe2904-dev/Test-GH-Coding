-- ==========================================
-- MIGRATE EXISTING USERS TO BUSINESS STRUCTURE
-- ==========================================
-- Run this AFTER applying APPLY_MIGRATIONS_IN_SUPABASE.sql
-- This creates business records for users who completed onboarding
-- before the business-level tier migration was applied
-- ==========================================

-- Create business records for existing users who completed onboarding
INSERT INTO public.businesses (
  owner_id,
  name,
  vertical,
  primary_language,
  plan,
  created_at,
  updated_at
)
SELECT 
  p.id,
  COALESCE(p.full_name, 'My Business') as name,
  'café' as vertical, -- Default to café, users can update later
  'da' as primary_language,
  'free' as plan,
  p.created_at,
  NOW()
FROM public.profiles p
WHERE p.onboarding_completed = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.businesses b 
    WHERE b.owner_id = p.id
  );

-- Create corresponding business_locations for the new businesses
INSERT INTO public.business_locations (
  business_id,
  postal_code,
  city,
  country,
  is_primary,
  created_at
)
SELECT 
  b.id,
  NULL as postal_code, -- No location data available from profiles
  NULL as city,
  'Danmark' as country,
  TRUE as is_primary,
  NOW()
FROM public.businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM public.business_locations bl 
  WHERE bl.business_id = b.id
);

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================
-- Run these to verify the migration worked:

-- 1. Check how many users now have business records
-- SELECT COUNT(*) as users_with_businesses FROM public.businesses;

-- 2. Check users who still need business records
-- SELECT 
--   p.id, 
--   p.full_name, 
--   p.email,
--   p.onboarding_completed
-- FROM public.profiles p
-- LEFT JOIN public.businesses b ON b.owner_id = p.id
-- WHERE p.onboarding_completed = TRUE
--   AND b.id IS NULL;

-- 3. Check all businesses and their owners
-- SELECT 
--   b.id,
--   b.name,
--   b.plan,
--   p.full_name as owner_name,
--   p.email as owner_email
-- FROM public.businesses b
-- JOIN public.profiles p ON p.id = b.owner_id
-- ORDER BY b.created_at DESC;

-- ==========================================
-- MIGRATION COMPLETE
-- ==========================================
-- All existing users who completed onboarding now have:
-- 1. A business record in the businesses table
-- 2. A business_locations record
-- 3. Default tier: 'free'
-- 4. Default vertical: 'café' (can be updated in Business Profile)
-- 
-- Users can now:
-- - Have their tier fetched properly by useBusinessTier hook
-- - Access all features according to their tier
-- - Update business details in Business Profile page
-- ==========================================
