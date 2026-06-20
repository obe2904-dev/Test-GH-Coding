-- 4B: Add content_strategy_confirmed flag to business_brand_profile.
-- When true, the AI-generated content_strategy.anchors have been reviewed and confirmed
-- by the business owner via the Brand page, and will be labelled as high-priority in the
-- Dagens Forslag prompt instead of "AI-suggested".
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS content_strategy_confirmed BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN business_brand_profile.content_strategy_confirmed IS
  'True when the business owner has reviewed and confirmed the AI-generated content_strategy.anchors via the Brand profile page.';
