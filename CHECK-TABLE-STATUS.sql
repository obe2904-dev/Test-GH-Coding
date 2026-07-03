-- Check if city_context_cache table exists and has data
SELECT 
  'Table exists' as status,
  COUNT(*) as row_count
FROM city_context_cache;

-- Check table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'city_context_cache'
ORDER BY ordinal_position;

-- Check RLS policies
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
WHERE tablename = 'city_context_cache';
