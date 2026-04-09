-- Migration: Link weekly_content_plans to weekly_strategies
-- Enables tracing which Layer 0 strategy drove each content plan

ALTER TABLE weekly_content_plans 
ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES weekly_strategies(id);

COMMENT ON COLUMN weekly_content_plans.strategy_id IS 
  'Link to Layer 0 strategy that drove this plan. NULL for legacy plans generated without Layer 0.';

-- Partial index: only index rows that have a strategy (most queries filter on this)
CREATE INDEX IF NOT EXISTS idx_weekly_content_plans_strategy_id 
  ON weekly_content_plans(strategy_id) 
  WHERE strategy_id IS NOT NULL;
