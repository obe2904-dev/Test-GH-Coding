-- Add has_kids_menu column to business_operations
ALTER TABLE business_operations ADD COLUMN IF NOT EXISTS has_kids_menu BOOLEAN DEFAULT false;

COMMENT ON COLUMN business_operations.has_kids_menu IS 'Whether the business offers a kids/children menu';
