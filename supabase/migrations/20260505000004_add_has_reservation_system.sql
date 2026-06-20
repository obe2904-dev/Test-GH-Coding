-- Add has_reservation_system column to business_operations
-- This column is used by the commercial strategy analyzer

ALTER TABLE business_operations
ADD COLUMN IF NOT EXISTS has_reservation_system BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN business_operations.has_reservation_system IS 
  'Whether the business has an active reservation/booking system (used by commercial strategy analysis)';

-- For existing businesses with reservation_required=true, set has_reservation_system=true
UPDATE business_operations
SET has_reservation_system = TRUE
WHERE reservation_required = TRUE;
