-- Add outdoor seating column to business_operations table
-- This field is detected by AI from website content and can be manually edited

ALTER TABLE business_operations 
ADD COLUMN IF NOT EXISTS has_outdoor_seating BOOLEAN DEFAULT false;

COMMENT ON COLUMN business_operations.has_outdoor_seating IS 'Whether the business offers outdoor seating/serving (ude servering, terrace, patio, etc.)';
