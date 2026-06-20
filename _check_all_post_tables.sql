-- Check which post-related tables actually exist in the database

SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = 'public' AND columns.table_name = tables.table_name) as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%post%'
  OR table_name LIKE '%draft%'
  OR table_name LIKE '%suggest%'
ORDER BY table_name;

-- Show all columns for each table found
DO $$
DECLARE
  tbl_name TEXT;
BEGIN
  FOR tbl_name IN 
    SELECT table_name 
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (table_name LIKE '%post%' OR table_name LIKE '%draft%' OR table_name LIKE '%suggest%')
  LOOP
    RAISE NOTICE '';
    RAISE NOTICE '=== Table: % ===', tbl_name;
    RAISE NOTICE 'Columns:';
    
    FOR rec IN 
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl_name
      ORDER BY ordinal_position
    LOOP
      RAISE NOTICE '  - %: %', rec.column_name, rec.data_type;
    END LOOP;
  END LOOP;
END $$;
