-- ============================================================================
-- DATABASE SCHEMA DIAGNOSTIC
-- ============================================================================
-- Run this first to see what tables exist in your database
-- ============================================================================

-- Check all tables in the public schema
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- If you see tables, check their columns
-- Uncomment and replace 'your_table_name' with actual table names:

-- SELECT 
--   table_name,
--   column_name,
--   data_type,
--   is_nullable,
--   column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
-- AND table_name IN ('businesses', 'posts', 'programs')  -- try 'programs' instead of 'programmes'
-- ORDER BY table_name, ordinal_position;
