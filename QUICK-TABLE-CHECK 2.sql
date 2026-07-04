-- Quick check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'city_context_cache'
) as table_exists;

-- If it exists, check row count
SELECT COUNT(*) as rows FROM city_context_cache;
