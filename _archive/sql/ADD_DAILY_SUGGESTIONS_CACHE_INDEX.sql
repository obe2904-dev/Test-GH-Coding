-- Speed up daily suggestions cache lookup in get-quick-suggestions.
-- The cache query filters on (business_id, date, is_active) and orders by position.
-- Without this index Postgres does a full table scan as the table grows.
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_cache
  ON public.daily_suggestions (business_id, date, is_active, position);
