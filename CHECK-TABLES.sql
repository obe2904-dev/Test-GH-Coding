-- Quick check: What tables exist in the database?
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE '%post%' 
   OR tablename LIKE '%draft%'
   OR tablename LIKE '%suggestion%'
   OR tablename LIKE '%content%'
ORDER BY tablename;
