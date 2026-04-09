-- Add strategy_rationale column to weekly_strategies
-- Stores the weekly modulation rationale from strategy-modulator.ts
-- Human-readable Danish text explaining why this week's content mix
-- differs from the brand's normal baseline.

ALTER TABLE weekly_strategies
  ADD COLUMN IF NOT EXISTS strategy_rationale TEXT;

COMMENT ON COLUMN weekly_strategies.strategy_rationale IS
  'Weekly modulation rationale from strategy-modulator.ts. '
  '1-2 sentences in Danish explaining why this week goal_blend / '
  'content_category_weights deviate from the brand baseline. '
  'NULL or contains "Ingen markante" when baseline was used unchanged.';
