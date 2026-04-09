-- Migration: Add content_strategy column to brand_profiles and goal_mode/content_category to weekly posts
-- Run this in Supabase SQL editor

-- 1. Business brand profile: add content_strategy column
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS content_strategy jsonb;

COMMENT ON COLUMN business_brand_profile.content_strategy IS
  'AI-inferred content strategy: primary_goal, goal_blend (footfall/brand/loyalty %), content_category_weights, footfall_signals[], brand_anchors[], loyalty_hooks[]';

-- 2. Weekly posts / post ideas: add goal_mode and content_category columns
-- weekly_content_plans stores posts as JSONB array – these columns are on the individual idea rows
-- For the strategy table (post_ideas are stored per-plan in weekly_content_plans.posts):
-- Nothing new needed structurally since post_ideas are JSONB.
-- But add convenience flat columns to the strategy post_ideas view if needed.

-- 3. For weekly_strategies, the post_ideas JSONB already holds per-post data.
-- Add indexed columns for analytics:
ALTER TABLE weekly_strategies
  ADD COLUMN IF NOT EXISTS content_strategy_snapshot jsonb;

COMMENT ON COLUMN weekly_strategies.content_strategy_snapshot IS
  'Snapshot of brand profile content_strategy used for this weeks slot assignment';

-- Verify columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('business_brand_profile', 'weekly_strategies')
  AND column_name IN ('content_strategy', 'content_strategy_snapshot')
ORDER BY table_name, column_name;
