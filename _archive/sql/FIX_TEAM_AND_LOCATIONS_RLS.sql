-- Fix business_team_members and business_locations RLS policies

-- Fix business_team_members table
ALTER TABLE public.business_team_members DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_member_select" ON public.business_team_members;
DROP POLICY IF EXISTS "team_member_insert" ON public.business_team_members;
DROP POLICY IF EXISTS "team_member_update" ON public.business_team_members;
DROP POLICY IF EXISTS "team_member_delete" ON public.business_team_members;
DROP POLICY IF EXISTS "Enable read access for team members" ON public.business_team_members;

ALTER TABLE public.business_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to read their team memberships"
  ON public.business_team_members FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Allow business owners to manage team"
  ON public.business_team_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = business_team_members.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Fix business_locations table
ALTER TABLE public.business_locations DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "location_select" ON public.business_locations;
DROP POLICY IF EXISTS "location_insert" ON public.business_locations;
DROP POLICY IF EXISTS "location_update" ON public.business_locations;
DROP POLICY IF EXISTS "location_delete" ON public.business_locations;
DROP POLICY IF EXISTS "Enable read access for business owners" ON public.business_locations;

ALTER TABLE public.business_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow owners to read their business locations"
  ON public.business_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = business_locations.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Allow owners to insert their business locations"
  ON public.business_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = business_locations.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Allow owners to update their business locations"
  ON public.business_locations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = business_locations.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Allow owners to delete their business locations"
  ON public.business_locations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = business_locations.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Verify
SELECT 
  'business_team_members policies' as check,
  COUNT(*) as count
FROM pg_policies 
WHERE tablename = 'business_team_members';

SELECT 
  'business_locations policies' as check,
  COUNT(*) as count
FROM pg_policies 
WHERE tablename = 'business_locations';
