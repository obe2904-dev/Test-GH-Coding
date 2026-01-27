-- Fix infinite recursion in business_team_members RLS policy
-- The issue: menu_results_v2 policy checks business_team_members, 
-- which has a policy that may be checking back, creating recursion

-- Step 1: Drop problematic policies on business_team_members
DROP POLICY IF EXISTS "Allow users to read their team memberships" ON public.business_team_members;
DROP POLICY IF EXISTS "Allow business owners to manage team" ON public.business_team_members;
DROP POLICY IF EXISTS "team_member_select" ON public.business_team_members;
DROP POLICY IF EXISTS "team_select_member" ON public.business_team_members;
DROP POLICY IF EXISTS "Team members can view their team" ON public.business_team_members;
DROP POLICY IF EXISTS "Owners can view team members" ON public.business_team_members;
DROP POLICY IF EXISTS "Team members can view other members" ON public.business_team_members;

-- Step 2: Create simple, non-recursive policies
-- Policy 1: Users can see their own team membership records
CREATE POLICY "btm_select_own"
  ON public.business_team_members FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 2: Business owners can see all team members for their business
-- This uses a direct join to businesses without going through team_members
CREATE POLICY "btm_select_owner"
  ON public.business_team_members FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Policy 3: Business owners can manage team members
CREATE POLICY "btm_manage_owner"
  ON public.business_team_members FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Step 3: Fix menu_results_v2 policy if it exists
DO $$
BEGIN
  IF to_regclass('public.menu_results_v2') IS NOT NULL THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "menu_results_v2_select" ON public.menu_results_v2;
    DROP POLICY IF EXISTS "menu_results_v2_insert" ON public.menu_results_v2;
    DROP POLICY IF EXISTS "menu_results_v2_update" ON public.menu_results_v2;
    DROP POLICY IF EXISTS "Enable read for users" ON public.menu_results_v2;
    DROP POLICY IF EXISTS "Enable insert for users" ON public.menu_results_v2;
    DROP POLICY IF EXISTS "Enable update for users" ON public.menu_results_v2;
    
    -- Recreate with simple owner-based policy (no team member check)
    CREATE POLICY "mrv2_select"
      ON public.menu_results_v2 FOR SELECT
      TO authenticated
      USING (
        business_id IN (
          SELECT id FROM public.businesses WHERE owner_id = auth.uid()
        )
      );
    
    CREATE POLICY "mrv2_insert"
      ON public.menu_results_v2 FOR INSERT
      TO authenticated
      WITH CHECK (
        business_id IN (
          SELECT id FROM public.businesses WHERE owner_id = auth.uid()
        )
      );
    
    CREATE POLICY "mrv2_update"
      ON public.menu_results_v2 FOR UPDATE
      TO authenticated
      USING (
        business_id IN (
          SELECT id FROM public.businesses WHERE owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Verify policies
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('business_team_members', 'menu_results_v2')
ORDER BY tablename, policyname;
