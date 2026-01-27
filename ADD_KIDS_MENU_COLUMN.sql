-- Run this in Supabase SQL Editor to add has_kids_menu column
ALTER TABLE business_operations ADD COLUMN IF NOT EXISTS has_kids_menu BOOLEAN DEFAULT false;

COMMENT ON COLUMN business_operations.has_kids_menu IS 'Whether the business offers a kids/children menu';

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'business_operations' AND column_name = 'has_kids_menu';
