-- ==========================================
-- TEST: Check if business exists and is accessible
-- ==========================================
-- Replace the UUID with your test user ID: 79240eba-2651-445c-8d4c-aaead7d06d9e
-- ==========================================

-- 1. Check if business exists
SELECT * FROM public.businesses 
WHERE owner_id = '79240eba-2651-445c-8d4c-aaead7d06d9e';

-- 2. Check current policies again
SELECT policyname, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'businesses'
ORDER BY policyname;

-- 3. Test the RLS policy logic manually
-- This simulates what auth.uid() = owner_id check does
SELECT 
  id,
  name,
  plan,
  owner_id,
  ('79240eba-2651-445c-8d4c-aaead7d06d9e'::uuid = owner_id) as "would_pass_rls"
FROM public.businesses
WHERE owner_id = '79240eba-2651-445c-8d4c-aaead7d06d9e';

-- ==========================================
-- If Query 1 returns results but the app gets 500:
-- The RLS policy is blocking even though data exists
--
-- If Query 1 returns no results:
-- Business wasn't created properly
-- ==========================================
