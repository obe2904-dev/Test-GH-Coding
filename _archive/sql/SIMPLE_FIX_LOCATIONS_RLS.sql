-- SIMPLIFIED FIX: Use owner_id column directly in business_locations policies

ALTER TABLE public.business_locations DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow owners to read their business locations" ON public.business_locations;
DROP POLICY IF EXISTS "Allow owners to insert their business locations" ON public.business_locations;
DROP POLICY IF EXISTS "Allow owners to update their business locations" ON public.business_locations;
DROP POLICY IF EXISTS "Allow owners to delete their business locations" ON public.business_locations;
DROP POLICY IF EXISTS "location_select" ON public.business_locations;
DROP POLICY IF EXISTS "location_insert" ON public.business_locations;
DROP POLICY IF EXISTS "location_update" ON public.business_locations;
DROP POLICY IF EXISTS "location_delete" ON public.business_locations;

ALTER TABLE public.business_locations ENABLE ROW LEVEL SECURITY;

-- Create simple policies using owner_id column directly
CREATE POLICY "locations_select_owner"
  ON public.business_locations FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "locations_insert_owner"
  ON public.business_locations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "locations_update_owner"
  ON public.business_locations FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "locations_delete_owner"
  ON public.business_locations FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Also fix business_team_members with simpler policies
ALTER TABLE public.business_team_members DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read their team memberships" ON public.business_team_members;
DROP POLICY IF EXISTS "Allow business owners to manage team" ON public.business_team_members;
DROP POLICY IF EXISTS "team_member_select" ON public.business_team_members;

ALTER TABLE public.business_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_select_member"
  ON public.business_team_members FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Verify
SELECT 'business_locations' as table_name, COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'business_locations'
UNION ALL
SELECT 'business_team_members' as table_name, COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'business_team_members';
