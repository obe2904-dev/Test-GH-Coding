-- Fix duplicate location records issue
-- Problem: Multiple is_primary=true records per business causing maybeSingle() to return null

-- Step 1: Delete all old duplicate location records, keep only the most recent one per business
DELETE FROM business_locations
WHERE id NOT IN (
  SELECT DISTINCT ON (business_id) id
  FROM business_locations
  WHERE is_primary = true
  ORDER BY business_id, created_at DESC
);

-- Step 2: Add unique constraint to prevent future duplicates
-- Only one primary location per business (using partial unique index)
DROP INDEX IF EXISTS unique_primary_location_per_business;

CREATE UNIQUE INDEX unique_primary_location_per_business 
ON business_locations (business_id) 
WHERE (is_primary = true);

-- Verify: Should show 1 record per business
SELECT 
  business_id,
  COUNT(*) as location_count,
  MAX(created_at) as latest_created
FROM business_locations
WHERE is_primary = true
GROUP BY business_id
HAVING COUNT(*) > 1;

-- This should return 0 rows if the fix worked
