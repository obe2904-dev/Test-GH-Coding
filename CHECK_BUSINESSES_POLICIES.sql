-- Check all policies on businesses table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'businesses' 
  AND schemaname = 'public'
ORDER BY policyname;

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'businesses' 
  AND schemaname = 'public';

-- Try the actual query that's failing
SELECT plan 
FROM businesses 
WHERE owner_id = '5292006d-f8d6-4dc9-b458-759c6fd4d541';
