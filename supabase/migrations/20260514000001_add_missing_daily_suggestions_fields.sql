-- =====================================================
-- MIGRATION: Add missing fields for daily_suggestions system
-- =====================================================
-- Adds remaining columns and functions needed by get-quick-suggestions
-- Edge Function after initial schema creation
-- =====================================================

-- ── 1. Add missing quota tracking column ──────────────────────────────────
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS last_quick_suggestions_reset DATE;

COMMENT ON COLUMN businesses.last_quick_suggestions_reset IS
  'Date of last quota counter reset. Used to reset quick_suggestions_today at midnight.';

-- ── 2. Add missing columns to daily_suggestions ───────────────────────────
ALTER TABLE daily_suggestions
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS generation_batch_id UUID,
  ADD COLUMN IF NOT EXISTS weather_forecast JSONB;

COMMENT ON COLUMN daily_suggestions.is_active IS
  'FALSE when a new batch is generated (prevents showing stale suggestions). TRUE for current batch.';
COMMENT ON COLUMN daily_suggestions.generation_batch_id IS
  'UUID linking all 3 suggestions from the same generation request. Used for batch deactivation.';
COMMENT ON COLUMN daily_suggestions.weather_forecast IS
  'Weather data snapshot when suggestion was generated. Used for regeneration context.';

-- Index for efficient active suggestions lookup
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_active 
  ON daily_suggestions(business_id, suggestion_date, is_active) 
  WHERE is_active = true;

-- ── 3. Create deactivation function ───────────────────────────────────────
-- Marks old suggestions as inactive when a new batch is generated
CREATE OR REPLACE FUNCTION deactivate_old_suggestions(
  p_business_id UUID,
  p_date DATE
)
RETURNS void AS $$
BEGIN
  UPDATE daily_suggestions
  SET is_active = false
  WHERE business_id = p_business_id
    AND suggestion_date = p_date
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION deactivate_old_suggestions IS
  'Marks all active suggestions for a business/date as inactive before inserting new batch.';
