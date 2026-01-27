-- CHECK EXISTING TABLES
-- Run this first to see what tables exist in your database

SELECT 
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename;

-- Check specifically for these common tables
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business_profile') 
    THEN '✓ EXISTS' ELSE '✗ NOT FOUND' 
  END as business_profile,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profile') 
    THEN '✓ EXISTS' ELSE '✗ NOT FOUND' 
  END as user_profile,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business_hours') 
    THEN '✓ EXISTS' ELSE '✗ NOT FOUND' 
  END as business_hours,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_media_posts') 
    THEN '✓ EXISTS' ELSE '✗ NOT FOUND' 
  END as social_media_posts,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'posts') 
    THEN '✓ EXISTS' ELSE '✗ NOT FOUND' 
  END as posts;
