-- ============================================================================
-- VERIFY BUSINESS_LOCATION_INTELLIGENCE TABLE STRUCTURE
-- ============================================================================
-- Check if category_scores column actually exists in the database
-- ============================================================================

-- 1. List ALL columns in business_location_intelligence
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_location_intelligence'
ORDER BY ordinal_position;

-- 2. Check if category_scores column specifically exists
SELECT 
  EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'business_location_intelligence'
      AND column_name = 'category_scores'
  ) as category_scores_exists;

-- 3. Show table creation statement (if available)
SELECT 
  tablename,
  tableowner
FROM pg_tables
WHERE tablename = 'business_location_intelligence';
