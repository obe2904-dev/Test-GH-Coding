-- URGENT: Check what columns actually exist in production business_operations table

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'business_operations'
ORDER BY ordinal_position;

-- If establishment_type is NOT in the list above, run this to add it:
-- (This is what the migration should have done)

ALTER TABLE public.business_operations 
ADD COLUMN IF NOT EXISTS establishment_type VARCHAR(10)
CHECK (establishment_type IS NULL OR establishment_type IN ('FSE', 'SBO'));

-- Then reload the schema cache:
NOTIFY pgrst, 'reload schema';

-- That's it. Menu extraction will work again.
