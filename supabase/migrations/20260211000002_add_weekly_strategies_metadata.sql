-- Add platform, tier, and post count metadata to weekly_strategies table
-- Layer 0 Enhancement: Track strategy generation metadata

ALTER TABLE weekly_strategies 
ADD COLUMN IF NOT EXISTS platforms TEXT[] DEFAULT ARRAY['facebook', 'instagram'],
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'smart',
ADD COLUMN IF NOT EXISTS target_post_count INTEGER DEFAULT 5;

-- Add comment for documentation
COMMENT ON COLUMN weekly_strategies.platforms IS 'Active social media platforms for this strategy';
COMMENT ON COLUMN weekly_strategies.subscription_tier IS 'Subscription tier (smart or pro) at time of generation';
COMMENT ON COLUMN weekly_strategies.target_post_count IS 'Number of post ideas generated based on preferred_posts_per_week';
