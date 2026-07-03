-- Add establishment type classification to business_operations
-- This field is automatically detected by AI and used internally for content strategy
-- Not visible to users in the UI

-- FSE = Full-Service Establishment (restaurants with complete meal service)
-- SBO = Specialized Beverage Outlet (coffee shops, bars, cafes with limited food)

ALTER TABLE business_operations 
ADD COLUMN IF NOT EXISTS establishment_type VARCHAR(10);

COMMENT ON COLUMN business_operations.establishment_type IS 'AI-detected classification: FSE (Full-Service Establishment) or SBO (Specialized Beverage Outlet). Used internally for content strategy.';

-- Add constraint to ensure valid values
ALTER TABLE business_operations 
ADD CONSTRAINT establishment_type_check 
CHECK (establishment_type IS NULL OR establishment_type IN ('FSE', 'SBO'));
