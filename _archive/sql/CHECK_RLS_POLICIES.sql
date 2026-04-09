-- Check RLS policies on businesses table
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles::text, 
  cmd, 
  qual::text,
  with_check::text
FROM pg_policies 
WHERE tablename = 'businesses' 
ORDER BY policyname;
