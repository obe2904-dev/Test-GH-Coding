-- Check database state after emergency fix
-- Run this in Supabase SQL Editor to diagnose login issues

-- 1. Check if critical tables exist
SELECT 
  table_name,
  CASE WHEN table_name IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('profiles', 'businesses', 'business_brand_profile', 'business_profile')
ORDER BY table_name;

-- 2. Check if the auth trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 3. Check if there are any users in auth.users
SELECT 
  COUNT(*) as total_auth_users,
  COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as confirmed_users
FROM auth.users;

-- 4. Check if there are matching profiles
SELECT 
  COUNT(*) as total_profiles
FROM public.profiles;

-- 5. Check if businesses table exists and has data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'businesses') THEN
    RAISE NOTICE 'Businesses table exists with % rows', (SELECT COUNT(*) FROM public.businesses);
  ELSE
    RAISE WARNING 'BUSINESSES TABLE IS MISSING - This will cause login to fail!';
  END IF;
END $$;
