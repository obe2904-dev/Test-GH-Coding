-- Add subscription_tier to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'smart';

-- Add constraint to ensure valid tier values
ALTER TABLE businesses
ADD CONSTRAINT valid_subscription_tier 
CHECK (subscription_tier IN ('smart', 'pro'));

-- Add index for tier queries
CREATE INDEX IF NOT EXISTS idx_businesses_subscription_tier 
ON businesses(subscription_tier);

COMMENT ON COLUMN businesses.subscription_tier IS 
'Subscription tier: smart (DKK 249/month - simplified UI) or pro (DKK 399/month - full control)';

-- Update existing businesses to 'pro' tier (so existing users aren't downgraded)
UPDATE businesses 
SET subscription_tier = 'pro' 
WHERE subscription_tier IS NULL;
