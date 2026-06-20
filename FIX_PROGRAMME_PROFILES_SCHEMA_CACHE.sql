-- ============================================================================
-- FIX: Refresh PostgREST Schema Cache for business_programme_profiles
-- ============================================================================
-- ISSUE: Frontend shows "Ingen programmer fundet" despite 3 programmes 
--        existing in database because PostgREST schema cache is stale
-- 
-- CAUSE: PostgREST caches the database schema and doesn't automatically
--        detect when new tables are added
--
-- SOLUTION: Send NOTIFY signal to reload schema cache
-- ============================================================================

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Verify the table exists and has data
SELECT 
  COUNT(*) as total_programmes,
  COUNT(DISTINCT business_id) as total_businesses,
  COUNT(DISTINCT programme_type) as unique_programme_types
FROM business_programme_profiles;

-- Show what programmes exist
SELECT 
  programme_name,
  programme_type,
  jsonb_array_length(audience_segments) as segment_count,
  confidence,
  created_at
FROM business_programme_profiles
ORDER BY programme_type;
