-- Check the businesses table constraints
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'businesses'::regclass;

-- Check the businesses table columns and their null constraints
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'businesses'
ORDER BY ordinal_position;

-- Check if there's an existing business for testing
SELECT id, owner_id, name, created_at
FROM businesses
LIMIT 5;
