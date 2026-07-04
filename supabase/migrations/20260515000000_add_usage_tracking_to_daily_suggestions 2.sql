-- =====================================================
-- MIGRATION: Add usage tracking to daily_suggestions
-- =====================================================
-- Track which suggestions are converted to text and when
-- Allows Free tier users to see their daily usage stats

-- ── 1. Add tracking columns ──────────────────────────
ALTER TABLE daily_suggestions
  ADD COLUMN IF NOT EXISTS text_generated_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_text_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_text_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN daily_suggestions.text_generated_count IS 
  'Number of times "Generer tekst" was clicked for this suggestion';
COMMENT ON COLUMN daily_suggestions.first_text_generated_at IS 
  'First time text was generated from this suggestion';
COMMENT ON COLUMN daily_suggestions.last_text_generated_at IS 
  'Most recent time text was generated from this suggestion';

-- ── 2. Create function to get daily usage stats ──────
CREATE OR REPLACE FUNCTION get_daily_usage_stats(
  p_business_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  regenerations_used INTEGER,
  regenerations_limit INTEGER,
  suggestions_count INTEGER,
  suggestions_selected INTEGER,
  texts_generated INTEGER,
  tier TEXT
) AS $$
DECLARE
  v_plan TEXT;
  v_regen_count INTEGER;
  v_regen_limit INTEGER;
BEGIN
  -- Get business plan and regeneration count
  SELECT 
    COALESCE(plan, 'free'),
    COALESCE(quick_suggestions_today, 0)
  INTO v_plan, v_regen_count
  FROM businesses
  WHERE id = p_business_id;
  
  -- Calculate tier-based regeneration limit
  v_regen_limit := CASE v_plan
    WHEN 'standardplus' THEN 3
    WHEN 'premium' THEN 5
    ELSE 1  -- Free tier: 1 regeneration per day
  END;
  
  -- Return stats for today's suggestions
  RETURN QUERY
  SELECT 
    v_regen_count AS regenerations_used,
    v_regen_limit AS regenerations_limit,
    COUNT(*)::INTEGER AS suggestions_count,
    COUNT(*) FILTER (WHERE text_generated_count > 0)::INTEGER AS suggestions_selected,
    COALESCE(SUM(text_generated_count), 0)::INTEGER AS texts_generated,
    v_plan AS tier
  FROM daily_suggestions
  WHERE business_id = p_business_id
    AND date = p_date
    AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_daily_usage_stats TO authenticated, service_role;

COMMENT ON FUNCTION get_daily_usage_stats IS 
  'Get daily usage statistics for a business showing regenerations, selections, and text generations';

-- ── 3. Create helper function to record text generation ──────
CREATE OR REPLACE FUNCTION record_text_generation(
  p_suggestion_id INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE daily_suggestions
  SET 
    text_generated_count = COALESCE(text_generated_count, 0) + 1,
    first_text_generated_at = COALESCE(first_text_generated_at, NOW()),
    last_text_generated_at = NOW()
  WHERE id = p_suggestion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_text_generation TO service_role;

COMMENT ON FUNCTION record_text_generation IS 
  'Record when text is generated from a suggestion, increments counter and updates timestamps';
