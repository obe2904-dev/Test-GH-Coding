-- Verify recognizable_interior_identity column exists
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'business_brand_profile'
    AND column_name = 'recognizable_interior_identity';

-- Also check the column comment
SELECT 
    pg_catalog.col_description(c.oid, cols.ordinal_position::int) as column_comment
FROM pg_catalog.pg_class c
JOIN information_schema.columns cols 
    ON cols.table_name = c.relname
WHERE cols.table_name = 'business_brand_profile'
    AND cols.column_name = 'recognizable_interior_identity';
