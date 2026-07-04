-- =====================================================
-- SERVICE PERIOD INTELLIGENCE
-- =====================================================
-- Derives service focus from opening hours and menu periods
-- Enables time-aware content suggestions

-- Add service period columns to business_operations
ALTER TABLE business_operations
ADD COLUMN IF NOT EXISTS service_periods TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS primary_service_period TEXT CHECK (primary_service_period IN ('breakfast', 'brunch', 'lunch', 'dinner', 'all_day', 'evening_only')),
ADD COLUMN IF NOT EXISTS posting_time_windows JSONB DEFAULT '[]'::jsonb;

-- Comments
COMMENT ON COLUMN business_operations.service_periods IS 'All service periods offered (e.g., ["breakfast", "lunch", "dinner"])';
COMMENT ON COLUMN business_operations.primary_service_period IS 'Main service focus derived from hours and menu';
COMMENT ON COLUMN business_operations.posting_time_windows IS 'Optimal posting times based on service periods. Format: [{"period": "lunch", "post_at": "10:30", "urgency_window": "11:00-14:00"}]';

-- =====================================================
-- FUNCTION: Derive Service Periods from Hours
-- =====================================================
CREATE OR REPLACE FUNCTION derive_service_periods(business_id_param UUID)
RETURNS TABLE (
  service_periods TEXT[],
  primary_period TEXT,
  posting_windows JSONB
) AS $$
DECLARE
  hours_data JSONB;
  menu_periods TEXT[];
  derived_periods TEXT[];
  primary_svc TEXT;
  windows JSONB;
BEGIN
  -- Get opening hours
  SELECT opening_hours INTO hours_data
  FROM business_profile
  WHERE id = business_id_param;
  
  -- Get menu periods from menu structure
  SELECT ARRAY_AGG(DISTINCT period) INTO menu_periods
  FROM (
    SELECT 
      CASE 
        WHEN LOWER(category->>'name') LIKE ANY(ARRAY['%breakfast%', '%morgenmad%']) THEN 'breakfast'
        WHEN LOWER(category->>'name') LIKE ANY(ARRAY['%brunch%']) THEN 'brunch'
        WHEN LOWER(category->>'name') LIKE ANY(ARRAY['%lunch%', '%frokost%']) THEN 'lunch'
        WHEN LOWER(category->>'name') LIKE ANY(ARRAY['%dinner%', '%aften%', '%middag%']) THEN 'dinner'
        ELSE NULL
      END AS period
    FROM menu_results_v2,
    LATERAL jsonb_array_elements(structured_data->'menuStructure') AS category
    WHERE business_id = business_id_param
    AND status = 'done'
  ) AS periods
  WHERE period IS NOT NULL;
  
  -- Determine primary period (simplified heuristic)
  IF 'all_day' = ANY(menu_periods) THEN
    primary_svc := 'all_day';
  ELSIF 'dinner' = ANY(menu_periods) AND NOT ('lunch' = ANY(menu_periods)) THEN
    primary_svc := 'dinner';
  ELSIF 'lunch' = ANY(menu_periods) AND NOT ('dinner' = ANY(menu_periods)) THEN
    primary_svc := 'lunch';
  ELSIF 'breakfast' = ANY(menu_periods) OR 'brunch' = ANY(menu_periods) THEN
    primary_svc := 'brunch';
  ELSE
    primary_svc := 'all_day';
  END IF;
  
  -- Build posting windows
  windows := jsonb_build_array(
    jsonb_build_object(
      'period', 'breakfast',
      'post_at', '07:30',
      'urgency_window', '07:00-10:30'
    ),
    jsonb_build_object(
      'period', 'lunch',
      'post_at', '10:30',
      'urgency_window', '11:30-14:00'
    ),
    jsonb_build_object(
      'period', 'dinner',
      'post_at', '15:00',
      'urgency_window', '17:00-21:00'
    )
  );
  
  derived_periods := COALESCE(menu_periods, ARRAY['all_day']::TEXT[]);
  
  RETURN QUERY SELECT derived_periods, primary_svc, windows;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION derive_service_periods IS 'Analyzes opening hours and menu to determine service periods and optimal posting times';

-- =====================================================
-- Example: Update service periods for a business
-- =====================================================
-- UPDATE business_operations bo
-- SET 
--   service_periods = sp.service_periods,
--   primary_service_period = sp.primary_period,
--   posting_time_windows = sp.posting_windows
-- FROM derive_service_periods(bo.id) sp
-- WHERE bo.id = 'your-business-id';
