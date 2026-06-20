-- =====================================================
-- COMMERCIAL MODE: INITIALIZE EXISTING BUSINESSES
-- =====================================================
-- Generates intelligent default trigger configurations
-- for all existing businesses based on their type and capabilities.
--
-- Run this AFTER main migration (20260505000001_add_commercial_mode_system.sql)
-- Generated: 5. maj 2026
-- =====================================================

-- Function to generate default trigger configuration based on business characteristics
CREATE OR REPLACE FUNCTION generate_default_trigger_config(
  p_business_id UUID,
  p_category TEXT,
  p_business_type TEXT,
  p_has_outdoor_seating BOOLEAN,
  p_service_periods TEXT[],
  p_location_type TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_config JSONB;
  v_has_brunch BOOLEAN;
  v_has_dinner BOOLEAN;
  v_is_waterfront BOOLEAN;
  v_is_fine_dining BOOLEAN;
BEGIN
  -- Analyze business characteristics
  v_has_brunch := 'brunch' = ANY(p_service_periods);
  v_has_dinner := 'dinner' = ANY(p_service_periods);
  v_is_waterfront := p_location_type = 'waterfront';
  v_is_fine_dining := p_business_type IN ('FSE', 'fine_dining');
  
  -- Base configuration object
  v_config := '{}'::jsonb;
  
  -- Valentine's Day
  IF p_category IN ('restaurant', 'bar', 'wine_bar') OR v_is_fine_dining OR v_has_dinner THEN
    v_config := jsonb_set(
      v_config,
      '{VD_WEEK}',
      jsonb_build_object(
        'enabled', true,
        'mode', 'booking_push',
        'min_booking_ideas', CASE WHEN v_is_fine_dining THEN 4 ELSE 3 END,
        'min_footfall_ideas', 1,
        'booking_window_days', 21,
        'reasoning', 'High reservation intent for romantic dining'
      )
    );
  END IF;
  
  -- Mother's Day
  IF p_category IN ('restaurant', 'café', 'brunch') OR v_has_brunch THEN
    v_config := jsonb_set(
      v_config,
      '{MD_WEEK}',
      jsonb_build_object(
        'enabled', true,
        'mode', 'booking_push',
        'min_booking_ideas', 3,
        'min_footfall_ideas', 1,
        'booking_window_days', 14,
        'reasoning', 'Family celebration - advance booking critical'
      )
    );
  END IF;
  
  -- Father's Day
  IF p_category IN ('restaurant', 'bar', 'steakhouse') OR v_has_dinner THEN
    v_config := jsonb_set(
      v_config,
      '{FD_WEEK}',
      jsonb_build_object(
        'enabled', true,
        'mode', 'booking_push',
        'min_booking_ideas', 2,
        'min_footfall_ideas', 2,
        'reasoning', 'Family celebration focus'
      )
    );
  END IF;
  
  -- First Weekend of Month
  IF p_category IN ('restaurant', 'café', 'bar', 'retail') THEN
    v_config := jsonb_set(
      v_config,
      '{FIRST_WEEKEND}',
      jsonb_build_object(
        'enabled', true,
        'mode', 'footfall_push',
        'min_booking_ideas', 1,
        'min_footfall_ideas', 4,
        'reasoning', 'Fresh month discretionary spending energy'
      )
    );
  END IF;
  
  -- Payday Period
  v_config := jsonb_set(
    v_config,
    '{PAYDAY_PERIOD}',
    jsonb_build_object(
      'enabled', true,
      'mode', 'footfall_push',
      'min_booking_ideas', 1,
      'min_footfall_ideas', 4,
      'reasoning', 'Increased spending capacity during payday windows'
    )
  );
  
  -- Weather Break (for outdoor seating venues)
  IF p_has_outdoor_seating OR v_is_waterfront THEN
    v_config := jsonb_set(
      v_config,
      '{WEATHER_BREAK}',
      jsonb_build_object(
        'enabled', true,
        'mode', 'footfall_push',
        'min_booking_ideas', 0,
        'min_footfall_ideas', 5,
        'priority', 95,
        'reasoning', CASE 
          WHEN v_is_waterfront THEN 'Waterfront location - outdoor seating is key differentiator'
          ELSE 'Outdoor seating available - capture first warm days'
        END
      )
    );
  END IF;
  
  -- Local Event (always context-dependent)
  v_config := jsonb_set(
    v_config,
    '{LOCAL_EVENT}',
    jsonb_build_object(
      'enabled', true,
      'mode', 'context_dependent',
      'reasoning', 'Adapt to high-commercial-weight local events'
    )
  );
  
  RETURN v_config;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_default_trigger_config IS 
  'Generates intelligent default trigger configuration based on business characteristics';

-- =====================================================
-- APPLY DEFAULT CONFIGURATIONS
-- =====================================================

DO $$
DECLARE
  v_business RECORD;
  v_config JSONB;
  v_baseline_mode TEXT;
  v_updated_count INTEGER := 0;
  v_has_outdoor BOOLEAN;
  v_service_periods TEXT[];
  v_location_type TEXT;
  v_has_reservation BOOLEAN;
BEGIN
  RAISE NOTICE 'Starting default trigger configuration generation...';
  RAISE NOTICE '';
  
  -- Loop through all businesses
  FOR v_business IN 
    SELECT 
      b.id,
      b.name,
      b.category,
      bbp.business_id
    FROM businesses b
    LEFT JOIN business_brand_profile bbp ON b.id = bbp.business_id
    WHERE bbp.trigger_configuration IS NULL
  LOOP
    -- Get business characteristics
    SELECT 
      COALESCE(
        (SELECT TRUE FROM media_assets ma 
         WHERE ma.business_id = v_business.id 
         AND (ma.is_exterior OR ma.category_tags && ARRAY['outdoor', 'terrace', 'patio'])
         LIMIT 1),
        FALSE
      ),
      COALESCE(
        (SELECT array_agg(DISTINCT service_period)
         FROM menu_results_v2
         WHERE business_id = v_business.id
         AND service_period IS NOT NULL),
        ARRAY[]::TEXT[]
      ),
      COALESCE(
        (SELECT bli.location_type
         FROM business_location_intelligence bli
         WHERE bli.business_id = v_business.id
         LIMIT 1),
        'city_center'
      ),
      COALESCE(
        (SELECT bo.has_reservation_system
         FROM business_operations bo
         WHERE bo.business_id = v_business.id
         LIMIT 1),
        FALSE
      )
    INTO v_has_outdoor, v_service_periods, v_location_type, v_has_reservation;
    
    -- Determine baseline mode
    IF v_has_reservation THEN
      v_baseline_mode := 'booking_push';
    ELSIF v_business.category IN ('café', 'coffee', 'retail', 'quick_service') THEN
      v_baseline_mode := 'footfall_push';
    ELSE
      v_baseline_mode := 'balanced';
    END IF;
    
    -- Generate config
    v_config := generate_default_trigger_config(
      v_business.id,
      v_business.category,
      COALESCE(
        (SELECT bbp2.business_type_code 
         FROM business_brand_profile bbp2 
         WHERE bbp2.business_id = v_business.id),
        'MFV'
      ),
      v_has_outdoor,
      v_service_periods,
      v_location_type
    );
    
    -- Update business_brand_profile
    UPDATE business_brand_profile
    SET 
      trigger_configuration = v_config,
      commercial_baseline_mode = v_baseline_mode,
      trigger_last_updated = NOW(),
      trigger_updated_by = 'system_migration'
    WHERE business_id = v_business.id;
    
    v_updated_count := v_updated_count + 1;
    
    IF v_updated_count <= 3 THEN
      RAISE NOTICE 'Configured: % (%, baseline: %, triggers: %)',
        v_business.name,
        v_business.category,
        v_baseline_mode,
        (SELECT COUNT(*) FROM jsonb_object_keys(v_config));
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Businesses updated: %', v_updated_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Baseline mode distribution:';
  RAISE NOTICE '  booking_push:  % businesses', 
    (SELECT COUNT(*) FROM business_brand_profile WHERE commercial_baseline_mode = 'booking_push');
  RAISE NOTICE '  footfall_push: % businesses', 
    (SELECT COUNT(*) FROM business_brand_profile WHERE commercial_baseline_mode = 'footfall_push');
  RAISE NOTICE '  balanced:      % businesses', 
    (SELECT COUNT(*) FROM business_brand_profile WHERE commercial_baseline_mode = 'balanced');
  RAISE NOTICE '';
  RAISE NOTICE 'Most common enabled triggers:';
  RAISE NOTICE '  VD_WEEK:        % businesses', 
    (SELECT COUNT(*) FROM business_brand_profile WHERE trigger_configuration->'VD_WEEK'->>'enabled' = 'true');
  RAISE NOTICE '  MD_WEEK:        % businesses', 
    (SELECT COUNT(*) FROM business_brand_profile WHERE trigger_configuration->'MD_WEEK'->>'enabled' = 'true');
  RAISE NOTICE '  WEATHER_BREAK:  % businesses', 
    (SELECT COUNT(*) FROM business_brand_profile WHERE trigger_configuration->'WEATHER_BREAK'->>'enabled' = 'true');
  RAISE NOTICE '  FIRST_WEEKEND:  % businesses', 
    (SELECT COUNT(*) FROM business_brand_profile WHERE trigger_configuration->'FIRST_WEEKEND'->>'enabled' = 'true');
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Review configurations in v_businesses_missing_commercial_config';
  RAISE NOTICE '  2. Test classifier with: SELECT * FROM trigger_catalog WHERE is_active = true;';
  RAISE NOTICE '  3. Update get-weekly-strategy to use commercial mode classifier';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- CLEANUP
-- =====================================================

-- Drop the temporary function (keep if you want to reuse it)
-- DROP FUNCTION IF EXISTS generate_default_trigger_config;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check configuration distribution
SELECT 
  commercial_baseline_mode,
  COUNT(*) as business_count
FROM business_brand_profile
WHERE trigger_configuration IS NOT NULL
GROUP BY commercial_baseline_mode
ORDER BY business_count DESC;

-- Check trigger enablement
SELECT 
  trigger_id,
  COUNT(*) as enabled_count
FROM business_brand_profile,
LATERAL jsonb_each(trigger_configuration) as t(trigger_id, config)
WHERE (config->>'enabled')::boolean = true
GROUP BY trigger_id
ORDER BY enabled_count DESC;

-- Sample configured businesses
SELECT 
  b.name,
  b.category,
  bbp.commercial_baseline_mode,
  (SELECT COUNT(*) 
   FROM jsonb_object_keys(bbp.trigger_configuration)) as trigger_count
FROM businesses b
JOIN business_brand_profile bbp ON b.id = bbp.business_id
WHERE bbp.trigger_configuration IS NOT NULL
LIMIT 10;
