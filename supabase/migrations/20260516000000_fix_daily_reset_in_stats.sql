-- =====================================================
-- FIX: Daily counter reset in get_daily_usage_stats
-- =====================================================
-- The counter needs to reset when viewing stats, not just when regenerating
-- This ensures accurate "Post i dag X/6" display even if user hasn't regenerated today

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
  v_last_reset DATE;
  v_needs_reset BOOLEAN;
BEGIN
  -- Get business plan, regeneration count, and last reset date
  SELECT 
    COALESCE(plan, 'free'),
    COALESCE(quick_suggestions_today, 0),
    last_quick_suggestions_reset
  INTO v_plan, v_regen_count, v_last_reset
  FROM businesses
  WHERE id = p_business_id;
  
  -- Check if counter needs to be reset for new day
  v_needs_reset := v_last_reset IS NULL OR v_last_reset < CURRENT_DATE;
  
  -- Reset counter if it's a new day
  IF v_needs_reset THEN
    UPDATE businesses 
    SET 
      quick_suggestions_today = 0,
      last_quick_suggestions_reset = CURRENT_DATE
    WHERE id = p_business_id;
    
    v_regen_count := 0;
    
    RAISE LOG 'Reset daily counter for business % (was %, now 0)', p_business_id, v_regen_count;
  END IF;
  
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

COMMENT ON FUNCTION get_daily_usage_stats IS 
  'Get daily usage statistics with automatic midnight reset. Ensures accurate counter display.';
