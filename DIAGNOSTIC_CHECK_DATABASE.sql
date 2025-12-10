-- ==========================================
-- DIAGNOSTIC: Check Current Database State
-- ==========================================
-- Run this to see what actually exists in your database
-- ==========================================

-- 1. Check if businesses table has the plan column
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'businesses'
ORDER BY ordinal_position;

-- 2. Check if the onboarding function exists
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'create_business_onboarding';

-- 3. Check RLS policies on businesses table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'businesses'
ORDER BY policyname;

-- 4. Check if RLS is enabled on businesses table
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'businesses';

-- 5. Sample query to test (replace with your user ID)
-- SELECT * FROM public.businesses WHERE owner_id = 'dd72c00b-839a-4e74-b2c4-f30ac7989da5';

-- ==========================================
-- EXPECTED RESULTS:
-- ==========================================
-- Query 1: Should show columns including 'plan', 'ai_generations_today', etc.
-- Query 2: Should show the create_business_onboarding function
-- Query 3: Should show RLS policies
-- Query 4: Should show rowsecurity = true
-- ==========================================
