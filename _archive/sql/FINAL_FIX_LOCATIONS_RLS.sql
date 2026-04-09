-- CORRECT FIX: Check ownership through businesses table join

ALTER TABLE public.business_locations DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow owners to read their business locations" ON public.business_locations;
DROP POLICY IF EXISTS "Allow owners to insert their business locations" ON public.business_locations;
DROP POLICY IF EXISTS "Allow owners to update their business locations" ON public.business_locations;
DROP POLICY IF EXISTS "Allow owners to delete their business locations" ON public.business_locations;
DROP POLICY IF EXISTS "locations_select_owner" ON public.business_locations;
DROP POLICY IF EXISTS "locations_insert_owner" ON public.business_locations;
DROP POLICY IF EXISTS "locations_update_owner" ON public.business_locations;
DROP POLICY IF EXISTS "locations_delete_owner" ON public.business_locations;
DROP POLICY IF EXISTS "location_select" ON public.business_locations;
DROP POLICY IF EXISTS "location_insert" ON public.business_locations;
DROP POLICY IF EXISTS "location_update" ON public.business_locations;
DROP POLICY IF EXISTS "location_delete" ON public.business_locations;

ALTER TABLE public.business_locations ENABLE ROW LEVEL SECURITY;

-- Create policies that check ownership through businesses table
CREATE POLICY "locations_select"
  ON public.business_locations FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses 
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "locations_insert"
  ON public.business_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses 
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "locations_update"
  ON public.business_locations FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses 
      WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses 
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "locations_delete"
  ON public.business_locations FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses 
      WHERE owner_id = auth.uid()
    )
  );

-- Fix business_team_members
ALTER TABLE public.business_team_members DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read their team memberships" ON public.business_team_members;
DROP POLICY IF EXISTS "Allow business owners to manage team" ON public.business_team_members;
DROP POLICY IF EXISTS "team_member_select" ON public.business_team_members;
DROP POLICY IF EXISTS "team_select_member" ON public.business_team_members;

ALTER TABLE public.business_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_select"
  ON public.business_team_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Verify
SELECT 'business_locations' as table_name, policyname, cmd
FROM pg_policies 
WHERE tablename = 'business_locations'
UNION ALL
SELECT 'business_team_members' as table_name, policyname, cmd
FROM pg_policies 
WHERE tablename = 'business_team_members'
ORDER BY table_name, cmd;
