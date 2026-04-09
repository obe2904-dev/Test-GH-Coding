-- TEMPORARY: Disable RLS to get the app working
-- WARNING: This removes security temporarily - only use for testing!

-- Disable RLS on business_locations
ALTER TABLE public.business_locations DISABLE ROW LEVEL SECURITY;

-- Disable RLS on business_team_members
ALTER TABLE public.business_team_members DISABLE ROW LEVEL SECURITY;

-- Disable RLS on profiles (if it's causing 400 errors)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Check RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename IN ('business_locations', 'business_team_members', 'profiles', 'businesses')
ORDER BY tablename;
