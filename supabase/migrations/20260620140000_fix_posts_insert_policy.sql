-- Fix INSERT policy for posts table
-- CRITICAL FIX: The businesses table uses 'owner_id' not 'user_id'
-- This was causing all INSERTs to fail RLS checks.

DROP POLICY IF EXISTS "Users can insert own posts" ON public.posts;

CREATE POLICY "Users can insert own posts"
  ON public.posts FOR INSERT
  WITH CHECK (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Also fix the other policies for consistency
DROP POLICY IF EXISTS "Users can read own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;

CREATE POLICY "Users can read own posts"
  ON public.posts FOR SELECT
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can update own posts"
  ON public.posts FOR UPDATE
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can delete own posts"
  ON public.posts FOR DELETE
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );
