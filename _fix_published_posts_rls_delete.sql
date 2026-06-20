-- =====================================================
-- FIX: Allow DELETE on published_posts table
-- =====================================================
-- Problem: RLS policy is blocking DELETE even when business_id matches
-- Solution: Add DELETE policy for authenticated users on their own business data
-- =====================================================

-- STEP 1: Check current RLS policies on published_posts
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
WHERE tablename = 'published_posts'
ORDER BY cmd, policyname;

-- STEP 2: Drop existing restrictive DELETE policy if it exists
-- (Run this only if STEP 1 shows a DELETE policy that's too restrictive)
-- DROP POLICY IF EXISTS "Users can delete their own posts" ON published_posts;
-- DROP POLICY IF EXISTS "Enable delete for authenticated users" ON published_posts;

-- STEP 3: Create new DELETE policy
-- Allow users to DELETE posts from businesses they have access to
CREATE POLICY "Allow delete for business members"
ON published_posts
FOR DELETE
TO authenticated
USING (
  business_id IN (
    SELECT business_id 
    FROM businesses 
    WHERE user_id = auth.uid()
  )
);

-- STEP 4: Verify the policy was created
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'published_posts'
  AND cmd = 'DELETE';
