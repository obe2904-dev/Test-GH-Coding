-- Migration: Add preferred_posts_per_week to business_operations
-- Layer 0 Enhancement: Allow businesses to configure desired weekly post count

-- Add the new column
ALTER TABLE business_operations 
ADD COLUMN IF NOT EXISTS preferred_posts_per_week INTEGER DEFAULT 5;

-- Add constraint to ensure reasonable values (1-10 posts per week)
ALTER TABLE business_operations
ADD CONSTRAINT check_preferred_posts_per_week 
CHECK (preferred_posts_per_week >= 1 AND preferred_posts_per_week <= 10);

-- Add comment explaining the column
COMMENT ON COLUMN business_operations.preferred_posts_per_week IS 
'Desired number of posts per week. Used by Layer 0 strategy generator. Range: 1-10. Default: 5';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_business_operations_preferred_posts 
ON business_operations(preferred_posts_per_week);

-- Update weekly_strategies table to store metadata about generated strategies
ALTER TABLE weekly_strategies
ADD COLUMN IF NOT EXISTS platforms TEXT[] DEFAULT ARRAY['facebook', 'instagram'],
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'smart',
ADD COLUMN IF NOT EXISTS target_post_count INTEGER DEFAULT 5;

-- Add comments for new columns
COMMENT ON COLUMN weekly_strategies.platforms IS 
'Active platforms for this strategy (facebook, instagram)';

COMMENT ON COLUMN weekly_strategies.subscription_tier IS 
'Subscription tier when strategy was generated (smart, pro)';

COMMENT ON COLUMN weekly_strategies.target_post_count IS 
'Number of post ideas generated (matches preferred_posts_per_week)';
