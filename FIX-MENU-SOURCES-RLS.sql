-- Fix menu_sources RLS policies to avoid infinite recursion
-- Use direct ownership check pattern (same as business_team_members fix)

-- Drop all existing policies on menu_sources
DROP POLICY IF EXISTS "Users can view their own business menu sources" ON menu_sources;
DROP POLICY IF EXISTS "Users can insert menu sources for their business" ON menu_sources;
DROP POLICY IF EXISTS "Users can update their own business menu sources" ON menu_sources;
DROP POLICY IF EXISTS "Users can delete their own business menu sources" ON menu_sources;

-- Create new non-recursive policies using direct ownership check
-- SELECT policy
CREATE POLICY "ms_select_owner"
  ON menu_sources FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- INSERT policy
CREATE POLICY "ms_insert_owner"
  ON menu_sources FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- UPDATE policy
CREATE POLICY "ms_update_owner"
  ON menu_sources FOR UPDATE
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

-- DELETE policy
CREATE POLICY "ms_delete_owner"
  ON menu_sources FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'menu_sources'
ORDER BY policyname;
