-- Fix preferred_posts_per_week constraint from 1-10 to 3-7
-- Layer 0 Enhancement: Correct the valid range

-- Drop the old constraint
ALTER TABLE business_operations 
DROP CONSTRAINT IF EXISTS business_operations_preferred_posts_per_week_check;

-- Add new constraint with correct range (3-7)
ALTER TABLE business_operations 
ADD CONSTRAINT business_operations_preferred_posts_per_week_check 
CHECK (preferred_posts_per_week IS NULL OR (preferred_posts_per_week >= 3 AND preferred_posts_per_week <= 7));

-- Update any values outside the new range to 5 (default)
UPDATE business_operations 
SET preferred_posts_per_week = 5 
WHERE preferred_posts_per_week IS NOT NULL 
  AND (preferred_posts_per_week < 3 OR preferred_posts_per_week > 7);
