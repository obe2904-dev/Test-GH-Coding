-- Fix duplicate business_locations rows
-- Run this in Supabase SQL Editor

-- Step 1: View all duplicates for your business
SELECT id, business_id, is_primary, postal_code, city, country, address_line1, phone, email, created_at
FROM business_locations 
WHERE business_id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8'
ORDER BY 
  CASE WHEN is_primary = true THEN 0 ELSE 1 END,
  CASE WHEN postal_code IS NOT NULL AND postal_code != '' THEN 0 ELSE 1 END,
  CASE WHEN city IS NOT NULL AND city != '' THEN 0 ELSE 1 END,
  created_at DESC;

-- Step 2: Delete duplicates, keeping only the best row (most complete, primary first)
-- IMPORTANT: Review the SELECT above first, then uncomment and run this:

/*
WITH ranked_locations AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY business_id 
           ORDER BY 
             CASE WHEN is_primary = true THEN 0 ELSE 1 END,
             CASE WHEN postal_code IS NOT NULL AND postal_code != '' THEN 0 ELSE 1 END,
             CASE WHEN city IS NOT NULL AND city != '' THEN 0 ELSE 1 END,
             created_at DESC
         ) as rn
  FROM business_locations
  WHERE business_id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8'
)
DELETE FROM business_locations
WHERE id IN (
  SELECT id FROM ranked_locations WHERE rn > 1
);
*/

-- Step 3: Verify only 1 row remains
SELECT COUNT(*) as remaining_rows FROM business_locations 
WHERE business_id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8';

-- Step 4: Ensure the remaining row is marked as primary
/*
UPDATE business_locations 
SET is_primary = true 
WHERE business_id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8';
*/

-- Step 5 (OPTIONAL): Add unique constraint to prevent future duplicates
-- Note: Only do this if you want to enforce one primary location per business
/*
CREATE UNIQUE INDEX IF NOT EXISTS unique_primary_location 
ON business_locations (business_id) 
WHERE is_primary = true;
*/
