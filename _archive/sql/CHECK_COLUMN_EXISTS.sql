-- Quick check: Does category_scores column exist?
-- Copy and run this in Supabase SQL Editor to verify

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'business_location_intelligence'
ORDER BY ordinal_position;

-- If you DON'T see 'category_scores' in the results, run this:
-- ALTER TABLE business_location_intelligence ADD COLUMN IF NOT EXISTS category_scores JSONB DEFAULT '{}'::jsonb;
