-- Check if RLS policies exist for menu_sources and menu_extractions
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('menu_sources', 'menu_extractions')
ORDER BY tablename, cmd;
