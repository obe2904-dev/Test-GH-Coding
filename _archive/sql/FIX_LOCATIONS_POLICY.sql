-- Fix business_locations RLS by removing duplicate/broken policy
-- The "Users can manage their business locations" policy has null with_check which blocks INSERTs

DROP POLICY IF EXISTS "Users can manage their business locations" ON public.business_locations;

-- Verify only one policy remains
SELECT 
  policyname,
  cmd,
  qual IS NOT NULL as has_using,
  with_check IS NOT NULL as has_with_check
FROM pg_policies
WHERE tablename = 'business_locations'
ORDER BY policyname;
