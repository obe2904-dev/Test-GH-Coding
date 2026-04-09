-- ==========================================
-- FIX: Remove Duplicate RLS Policies
-- ==========================================
-- The problem: Both old and new policies exist
-- The old ones with role {public} are blocking queries
-- ==========================================

-- Remove ALL policies from businesses table
DROP POLICY IF EXISTS "Owners can delete own business" ON public.businesses;
DROP POLICY IF EXISTS "Owners can update own business" ON public.businesses;
DROP POLICY IF EXISTS "Users can create own business" ON public.businesses;
DROP POLICY IF EXISTS "Users can delete own business" ON public.businesses;
DROP POLICY IF EXISTS "Users can insert own business" ON public.businesses;
DROP POLICY IF EXISTS "Users can update own business" ON public.businesses;
DROP POLICY IF EXISTS "Users can view own business" ON public.businesses;
DROP POLICY IF EXISTS "Users can view their business" ON public.businesses;

-- Now create ONLY the correct policies for authenticated users
CREATE POLICY "Users can view their business"
  ON public.businesses FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.business_team_members
      WHERE business_id = businesses.id
      AND user_id = auth.uid()
      AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "Users can create own business"
  ON public.businesses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update own business"
  ON public.businesses FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete own business"
  ON public.businesses FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- ==========================================
-- VERIFICATION
-- ==========================================
-- Run this to verify only 4 policies exist now:
-- SELECT policyname, roles, cmd 
-- FROM pg_policies 
-- WHERE tablename = 'businesses'
-- ORDER BY policyname;
--
-- Should show:
-- 1. Owners can delete own business | {authenticated} | DELETE
-- 2. Owners can update own business | {authenticated} | UPDATE
-- 3. Users can create own business  | {authenticated} | INSERT
-- 4. Users can view their business  | {authenticated} | SELECT
-- ==========================================
