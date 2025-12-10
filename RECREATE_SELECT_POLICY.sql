-- Drop and recreate the SELECT policy with explicit casting
DROP POLICY IF EXISTS "Users can view their business" ON businesses;

CREATE POLICY "Users can view their business"
ON businesses
FOR SELECT
TO authenticated
USING (
  (auth.uid() = owner_id) 
  OR 
  EXISTS (
    SELECT 1 
    FROM business_team_members
    WHERE business_team_members.business_id = businesses.id
      AND business_team_members.user_id = auth.uid()
      AND business_team_members.accepted_at IS NOT NULL
  )
);

-- Verify it was created
SELECT policyname, cmd, qual::text
FROM pg_policies 
WHERE tablename = 'businesses' AND policyname = 'Users can view their business';
