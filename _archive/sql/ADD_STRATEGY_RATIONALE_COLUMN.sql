-- Add strategy_rationale column to weekly_strategies
-- Stores the weekly modulation rationale from strategy-modulator.ts
-- Human-readable Danish text explaining why this week's content mix
-- differs from the brand's normal baseline (e.g. "Varm uge med sol og
-- udeservering — vi vægter mere stemningsindhold denne uge.")

ALTER TABLE weekly_strategies
  ADD COLUMN IF NOT EXISTS strategy_rationale TEXT;

COMMENT ON COLUMN weekly_strategies.strategy_rationale IS
  'Weekly modulation rationale from strategy-modulator.ts. '
  '1-2 sentences in Danish explaining why this week''s goal_blend / '
  'content_category_weights deviate from the brand baseline. '
  'NULL or "Ingen markante kontekstuelle signaler" = baseline was used unchanged.';
