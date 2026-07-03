-- Fix get_daily_usage_stats function to remove reference to non-existent 'selected' column
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
  -- Get business tier and regeneration count
  SELECT 
    plan,
    COALESCE(quick_suggestions_today, 0)
  INTO v_plan, v_regen_count
  FROM businesses
  WHERE id = p_business_id;

  -- Set regeneration limit based on tier
  v_regen_limit := CASE 
    WHEN v_plan = 'free' THEN 1  -- Free tier: 1 regeneration per day
    WHEN v_plan = 'smart' THEN 3
    WHEN v_plan = 'pro' THEN 5
    ELSE 1  -- Default to free tier
  END;

  -- Return aggregated stats
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
