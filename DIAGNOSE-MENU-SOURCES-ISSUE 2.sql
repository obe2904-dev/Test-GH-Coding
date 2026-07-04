-- COMPREHENSIVE DIAGNOSTIC for menu_sources issue

-- 1. Check if RLS is enabled on menu_sources
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'menu_sources';

-- 2. List ALL RLS policies on menu_sources
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'menu_sources'
ORDER BY policyname;

-- 3. Count total menu_sources records (as service_role, bypasses RLS)
-- Run this in Supabase SQL Editor which uses service_role
SELECT COUNT(*) as total_menu_sources
FROM menu_sources;

-- 4. Count menu_sources for Cafe Faust specifically
SELECT COUNT(*) as cafe_faust_menu_sources
FROM menu_sources
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 5. Show actual menu_sources for Cafe Faust
SELECT 
  id,
  source_url,
  label,
  menu_type,
  status,
  created_at
FROM menu_sources
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC;

-- 6. Check if businesses table has the Cafe Faust record
SELECT 
  id,
  name,
  owner_id,
  plan
FROM businesses
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 7. Check current user's auth.uid() - run this to see who you're logged in as
SELECT auth.uid() as current_user_id;

-- 8. Check if current user owns Cafe Faust business
SELECT 
  b.id,
  b.name,
  b.owner_id,
  (b.owner_id = auth.uid()) as i_own_this
FROM businesses b
WHERE b.id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
