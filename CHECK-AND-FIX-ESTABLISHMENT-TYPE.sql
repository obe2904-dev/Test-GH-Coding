-- DIAGNOSTIC: Check if establishment_type column exists
-- If it exists, this is a schema cache issue, not a missing column

SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'business_operations'
AND column_name = 'establishment_type';

-- If the query above returns a row, the column EXISTS and you need to reload the schema cache
-- Solution: In Supabase Dashboard, go to Database > Roles > postgrest_anon_role
-- Or run this to reload the schema cache:

NOTIFY pgrst, 'reload schema';
