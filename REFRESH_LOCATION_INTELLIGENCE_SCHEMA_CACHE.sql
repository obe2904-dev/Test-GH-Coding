-- ============================================================================
-- REFRESH POSTGREST SCHEMA CACHE FOR LOCATION INTELLIGENCE
-- ============================================================================
-- PostgREST doesn't know about columns in business_location_intelligence table
-- This causes saves to fail with "column not found in schema cache" errors
-- ============================================================================

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- Verify the table exists and has the expected columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_location_intelligence'
ORDER BY ordinal_position;

-- Check if RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'business_location_intelligence';

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename = 'business_location_intelligence'
ORDER BY policyname;
