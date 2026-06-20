-- STEP 1: First run migration 20260505000004_add_has_reservation_system.sql
-- This adds the missing has_reservation_system column

-- STEP 2: Then run this update for Cafe Faust
UPDATE business_operations
SET 
  has_reservation_system = TRUE,
  reservation_required = FALSE  -- Cafe Faust accepts walk-ins
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- Verify the update
SELECT 
  business_id,
  has_reservation_system,
  reservation_required,
  accepts_walk_ins
FROM business_operations
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
