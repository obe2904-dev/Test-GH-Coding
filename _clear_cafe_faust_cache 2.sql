-- Clear cached location intelligence for Café Faust
-- This forces a fresh analysis with the new Danish waterfront detection
-- Run this in Supabase SQL Editor

UPDATE business_location_intelligence
SET last_updated_by_ai = NULL
WHERE business_id = '2feada74-fedf-4434-a93e-5821463a265a';

-- Verify the update
SELECT 
  business_id,
  neighborhood,
  area_type,
  last_updated_by_ai
FROM business_location_intelligence
WHERE business_id = '2feada74-fedf-4434-a93e-5821463a265a';
