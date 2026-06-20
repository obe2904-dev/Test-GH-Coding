-- Check RLS policies on menu_sources table
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
WHERE tablename = 'menu_sources'
ORDER BY policyname;

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'menu_sources';

-- Try to count menu_sources for Cafe Faust
SELECT COUNT(*) as total_count
FROM menu_sources
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Check if there are ANY menu_sources at all (bypassing RLS with service role would show this)
SELECT 
  id,
  business_id,
  source_url,
  label,
  created_at
FROM menu_sources
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
LIMIT 10;
