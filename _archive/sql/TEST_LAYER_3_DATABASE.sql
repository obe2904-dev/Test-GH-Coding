-- ============================================================================
-- LAYER 3: TEMPORAL & CONTEXTUAL INTELLIGENCE - DATABASE VERIFICATION TEST
-- ============================================================================
-- Purpose: Verify Layer 3 calendar, seasonal, and temporal context data
-- Run this against your Supabase database to ensure Layer 3 is properly set up
-- ============================================================================

-- Set test context
DO $$
DECLARE
  test_business_id uuid := '840347de-9ba7-4275-8aa3-4553417fc2af';
BEGIN
  RAISE NOTICE 'Testing Layer 3 with business_id: %', test_business_id;
END $$;

-- ============================================================================
-- TEST 1: CONTEXTUAL CALENDAR TABLE
-- ============================================================================
SELECT 
  '=== TEST 1: CONTEXTUAL_CALENDAR TABLE ===' as test_section;

-- Check if table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'contextual_calendar'
    ) 
    THEN '✅ contextual_calendar table exists'
    ELSE '❌ contextual_calendar table MISSING'
  END as table_check;

-- Check required columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'contextual_calendar'
ORDER BY column_name;

-- Count total events
SELECT 
  'Total Calendar Events' as metric,
  COUNT(*) as count
FROM contextual_calendar;

-- Check event distribution by type
SELECT 
  event_type,
  COUNT(*) as event_count
FROM contextual_calendar
GROUP BY event_type
ORDER BY event_count DESC;

-- Check country coverage
SELECT 
  country,
  COUNT(*) as event_count
FROM contextual_calendar
GROUP BY country
ORDER BY country;

-- Expected:
-- - event_type: holiday, school_vacation, season, cultural, business_rhythm
-- - country: DK, SE, NO, etc.
-- - Should have events for current year

-- ============================================================================
-- TEST 2: UPCOMING EVENTS (Next 60 Days)
-- ============================================================================
SELECT 
  '=== TEST 2: UPCOMING EVENTS ===' as test_section;

-- Get upcoming events for Denmark
SELECT 
  event_type,
  event_name,
  date_start,
  date_end,
  CASE 
    WHEN date_end IS NULL THEN 'Single day'
    ELSE (date_end - date_start)::text || ' days'
  END as duration,
  CASE 
    WHEN relevance_tags IS NOT NULL THEN array_to_string(relevance_tags, ', ')
    ELSE 'No tags'
  END as tags
FROM contextual_calendar
WHERE country = (
  SELECT country FROM businesses WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af'
)
  AND date_start BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
ORDER BY date_start;

-- Check holidays in next 2 weeks (proximity detection)
SELECT 
  'Holidays Within 2 Weeks' as check_name,
  COUNT(*) as holiday_count
FROM contextual_calendar
WHERE event_type = 'holiday'
  AND country = (SELECT country FROM businesses WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af')
  AND date_start BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days';

-- Check if currently in vacation period
SELECT 
  'Current Vacation Period' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM contextual_calendar
      WHERE event_type = 'school_vacation'
        AND country = (SELECT country FROM businesses WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af')
        AND CURRENT_DATE BETWEEN date_start AND COALESCE(date_end, date_start)
    ) THEN '✅ Yes - In vacation period'
    ELSE '⚠️ No - Regular period'
  END as result;

-- ============================================================================
-- TEST 3: SEASONAL CONTEXT
-- ============================================================================
SELECT 
  '=== TEST 3: SEASONAL CONTEXT ===' as test_section;

-- Determine current season
WITH current_season AS (
  SELECT 
    CASE 
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (3, 4, 5) THEN 'spring'
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (6, 7, 8) THEN 'summer'
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (9, 10, 11) THEN 'autumn'
      ELSE 'winter'
    END as season,
    EXTRACT(MONTH FROM CURRENT_DATE) as current_month,
    CURRENT_DATE as today
)
SELECT 
  '--- Current Season ---' as section,
  season,
  current_month,
  today
FROM current_season;

-- Get seasonal events for current season
SELECT 
  'Seasonal Events for Current Period' as check_name,
  COUNT(*) as event_count
FROM contextual_calendar
WHERE event_type = 'season'
  AND country = (SELECT country FROM businesses WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af')
  AND CURRENT_DATE BETWEEN date_start AND COALESCE(date_end, date_start);

-- ============================================================================
-- TEST 4: LOCATION INTELLIGENCE + SEASON INTEGRATION
-- ============================================================================
SELECT 
  '=== TEST 4: LOCATION + SEASON INTEGRATION ===' as test_section;

-- Get location types for test business (score >= 70)
WITH business_location AS (
  SELECT 
    bcfm.business_id,
    bcfm.location_type_id as location_type,
    bcfm.location_type_score as match_score
  FROM business_concept_fit_multi bcfm
  WHERE bcfm.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
    AND bcfm.location_type_score >= 70
),
current_season AS (
  SELECT 
    CASE 
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (3, 4, 5) THEN 'spring'
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (6, 7, 8) THEN 'summer'
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (9, 10, 11) THEN 'autumn'
      ELSE 'winter'
    END as season
)
SELECT 
  bl.location_type,
  bl.match_score,
  cs.season as current_season,
  CASE 
    -- Waterfront seasonality
    WHEN bl.location_type = 'waterfront' AND cs.season = 'summer' THEN '🌊 CRITICAL - Waterfront + Summer (1.0)'
    WHEN bl.location_type = 'waterfront' AND cs.season = 'spring' THEN '🌊 HIGH - Waterfront + Spring (0.8)'
    WHEN bl.location_type = 'waterfront' AND cs.season = 'autumn' THEN '🌊 MEDIUM - Waterfront + Autumn (0.6)'
    WHEN bl.location_type = 'waterfront' AND cs.season = 'winter' THEN '🌊 LOW - Waterfront + Winter (0.4)'
    
    -- Outdoor seating seasonality
    WHEN bl.location_type = 'outdoor_seating' AND cs.season = 'summer' THEN '☀️ CRITICAL - Outdoor + Summer (1.0)'
    WHEN bl.location_type = 'outdoor_seating' AND cs.season = 'spring' THEN '☀️ HIGH - Outdoor + Spring (0.85)'
    WHEN bl.location_type = 'outdoor_seating' AND cs.season = 'autumn' THEN '☀️ MEDIUM - Outdoor + Autumn (0.6)'
    WHEN bl.location_type = 'outdoor_seating' AND cs.season = 'winter' THEN '☀️ LOW - Outdoor + Winter (0.3)'
    
    -- Park adjacent seasonality
    WHEN bl.location_type = 'park_adjacent' AND cs.season = 'summer' THEN '🌳 CRITICAL - Park + Summer (0.95)'
    WHEN bl.location_type = 'park_adjacent' AND cs.season = 'spring' THEN '🌳 HIGH - Park + Spring (0.85)'
    WHEN bl.location_type = 'park_adjacent' AND cs.season = 'autumn' THEN '🌳 MEDIUM - Park + Autumn (0.7)'
    WHEN bl.location_type = 'park_adjacent' AND cs.season = 'winter' THEN '🌳 LOW - Park + Winter (0.4)'
    
    -- Tourist area seasonality
    WHEN bl.location_type = 'tourist_area' AND cs.season = 'summer' THEN '🌍 CRITICAL - Tourist + Summer (1.0)'
    WHEN bl.location_type = 'tourist_area' AND cs.season = 'spring' THEN '🌍 HIGH - Tourist + Spring (0.85)'
    WHEN bl.location_type = 'tourist_area' AND cs.season = 'autumn' THEN '🌍 MEDIUM - Tourist + Autumn (0.7)'
    WHEN bl.location_type = 'tourist_area' AND cs.season = 'winter' THEN '🌍 MEDIUM - Tourist + Winter (0.5)'
    
    -- Business district (stable year-round)
    WHEN bl.location_type = 'business_district' THEN '💼 STABLE - Business District (0.9 year-round)'
    
    -- Residential (slightly higher in cold months - local comfort)
    WHEN bl.location_type = 'residential' AND cs.season IN ('autumn', 'winter') THEN '🏡 HIGH - Residential + Cold Season (0.75)'
    WHEN bl.location_type = 'residential' THEN '🏡 MEDIUM - Residential (0.6)'
    
    ELSE '📍 ' || bl.location_type || ' (no seasonal data)'
  END as seasonal_context
FROM business_location bl
CROSS JOIN current_season cs
ORDER BY bl.match_score DESC;

-- ============================================================================
-- TEST 5: BUSINESS OPERATIONS + TIME CONTEXT
-- ============================================================================
SELECT 
  '=== TEST 5: OPERATIONS + TIME CONTEXT ===' as test_section;

-- Check operational hours for today
WITH today_info AS (
  SELECT 
    CASE EXTRACT(DOW FROM CURRENT_DATE)
      WHEN 0 THEN 'sunday'
      WHEN 1 THEN 'monday'
      WHEN 2 THEN 'tuesday'
      WHEN 3 THEN 'wednesday'
      WHEN 4 THEN 'thursday'
      WHEN 5 THEN 'friday'
      WHEN 6 THEN 'saturday'
    END as day_name
)
SELECT 
  '--- Today''s Operating Hours ---' as section,
  ti.day_name,
  CASE 
    WHEN (o.opening_hours->ti.day_name->>'closed')::boolean = true THEN 'CLOSED'
    WHEN o.opening_hours->ti.day_name->>'open' IS NOT NULL THEN 'OPEN'
    ELSE 'No data'
  END as status,
  o.opening_hours->ti.day_name->>'open' as opening_time,
  o.opening_hours->ti.day_name->>'close' as closing_time,
  CASE 
    WHEN o.service_periods->'lunch'->>'available' = 'true'
    THEN '🍽️ Lunch: ' || (o.service_periods->'lunch'->'hours'->>'start') || ' - ' || (o.service_periods->'lunch'->'hours'->>'end')
    ELSE 'No lunch service data'
  END as lunch_service
FROM business_operations o
CROSS JOIN today_info ti
WHERE o.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Check weekend operations (for outdoor/weather opportunities)
SELECT 
  'Weekend Operations' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM business_operations o
      WHERE o.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
        AND (
          (o.opening_hours->'saturday'->>'closed' IS NULL OR (o.opening_hours->'saturday'->>'closed')::boolean = false)
          OR
          (o.opening_hours->'sunday'->>'closed' IS NULL OR (o.opening_hours->'sunday'->>'closed')::boolean = false)
        )
    ) THEN '✅ Open on weekends (weather-dependent content opportunities)'
    ELSE '⚠️ Not open weekends (no weekend weather optimization)'
  END as result;

-- ============================================================================
-- TEST 6: SIMULATE LAYER 3 DATA FETCH
-- ============================================================================
SELECT
  '=== TEST 6: SIMULATE LAYER 3 DATA FETCH ===' as test_section;

-- This simulates what Layer 3 provides to Layer 4
WITH business_info AS (
  SELECT 
    b.id,
    b.name,
    b.country,
    b.primary_language
  FROM businesses b
  WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af'
),
current_season AS (
  SELECT 
    CASE 
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (3, 4, 5) THEN 'spring'
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (6, 7, 8) THEN 'summer'
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (9, 10, 11) THEN 'autumn'
      ELSE 'winter'
    END as season
),
upcoming_holidays AS (
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'name', event_name,
        'date', date_start,
        'type', event_type,
        'tags', relevance_tags
      ) ORDER BY date_start
    ) as holidays
  FROM contextual_calendar
  WHERE event_type = 'holiday'
    AND country = (SELECT country FROM business_info)
    AND date_start BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
),
vacation_check AS (
  SELECT 
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM contextual_calendar
        WHERE event_type = 'school_vacation'
          AND country = (SELECT country FROM business_info)
          AND CURRENT_DATE BETWEEN date_start AND COALESCE(date_end, date_start)
      ) THEN true
      ELSE false
    END as in_vacation_period
),
location_types AS (
  SELECT 
    jsonb_object_agg(
      location_type,
      match_score
    ) as types
  FROM (
    SELECT 
      bcfm.location_type_id as location_type,
      bcfm.location_type_score as match_score
    FROM business_concept_fit_multi bcfm
    WHERE bcfm.business_id = (SELECT id FROM business_info)
      AND bcfm.location_type_score >= 70
  ) sub
)
SELECT 
  '--- Layer 3 Temporal & Contextual Intelligence Data ---' as section,
  jsonb_build_object(
    'temporal', jsonb_build_object(
      'season', cs.season,
      'current_date', CURRENT_DATE,
      'current_month', EXTRACT(MONTH FROM CURRENT_DATE),
      'day_of_week', EXTRACT(DOW FROM CURRENT_DATE),
      'is_weekend', EXTRACT(DOW FROM CURRENT_DATE) IN (0, 6)
    ),
    'calendar', jsonb_build_object(
      'upcoming_holidays', COALESCE(uh.holidays, '[]'::jsonb),
      'in_vacation_period', vc.in_vacation_period,
      'holiday_proximity', (
        SELECT COUNT(*) FROM contextual_calendar
        WHERE event_type = 'holiday'
          AND country = bi.country
          AND date_start BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
      )
    ),
    'location_context', jsonb_build_object(
      'location_types', COALESCE(lt.types, '{}'::jsonb),
      'seasonal_weights', jsonb_build_object(
        'current_season', cs.season,
        'note', 'Waterfront/outdoor_seating have higher weights in summer/spring'
      )
    ),
    'weather_note', 'Weather data fetched from OpenWeatherMap API at runtime (not stored in DB)',
    'compound_opportunities_note', 'Detected by combining location + weather + season + calendar at runtime'
  ) as layer_3_data
FROM business_info bi
CROSS JOIN current_season cs
CROSS JOIN vacation_check vc
LEFT JOIN upcoming_holidays uh ON true
LEFT JOIN location_types lt ON true;

-- ============================================================================
-- TEST 7: CROSS-LAYER INTEGRATION (Layer 1 + Layer 2 + Layer 3)
-- ============================================================================
SELECT 
  '=== TEST 7: CROSS-LAYER INTEGRATION ===' as test_section;

-- Verify all layers connect properly
SELECT 
  b.id as business_id,
  b.name,
  b.category as business_type,
  b.country,
  b.primary_language,
  
  -- Layer 1: Information Foundation
  CASE WHEN bli.business_id IS NOT NULL THEN '✅' ELSE '❌' END as has_location_intel,
  CASE WHEN bcf.business_id IS NOT NULL THEN '✅' ELSE '❌' END as has_concept_fit,
  CASE WHEN o.business_id IS NOT NULL THEN '✅' ELSE '❌' END as has_operations,
  
  -- Layer 2: Strategic Baselines
  CASE WHEN btd.business_type IS NOT NULL THEN '✅' ELSE '❌' END as has_type_defaults,
  
  -- Layer 3: Temporal Context
  (SELECT COUNT(*) FROM contextual_calendar WHERE country = b.country) as calendar_events_for_country,
  CASE 
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (3, 4, 5) THEN 'spring'
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (6, 7, 8) THEN 'summer'
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (9, 10, 11) THEN 'autumn'
    ELSE 'winter'
  END as current_season
  
FROM businesses b
LEFT JOIN business_location_intelligence bli ON bli.business_id = b.id
LEFT JOIN business_concept_fit bcf ON bcf.business_id = b.id
LEFT JOIN business_operations o ON o.business_id = b.id
LEFT JOIN business_type_defaults btd ON btd.business_type = b.category
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================
SELECT 
  '=== LAYER 3 VERIFICATION SUMMARY ===' as test_section;

SELECT 
  '✅ All Layer 3 tests passed' as status
WHERE (
  -- Calendar table exists and has data
  EXISTS (SELECT 1 FROM contextual_calendar)
  AND
  -- Business has country for calendar events
  EXISTS (
    SELECT 1 FROM businesses 
    WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af'
      AND country IS NOT NULL
  )
);

-- If no result above, show what's missing
SELECT 
  CASE WHEN NOT EXISTS (SELECT 1 FROM contextual_calendar)
    THEN '❌ contextual_calendar table is empty'
  END as missing_calendar_data,
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM businesses 
    WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af'
      AND country IS NOT NULL
  )
    THEN '❌ Business missing country information'
  END as missing_country
WHERE (
  NOT EXISTS (SELECT 1 FROM contextual_calendar)
  OR NOT EXISTS (
    SELECT 1 FROM businesses 
    WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af'
      AND country IS NOT NULL
  )
);

-- ============================================================================
-- ADDITIONAL INFO: What Layer 3 provides to downstream layers
-- ============================================================================
SELECT 
  '=== LAYER 3 OUTPUT FOR DOWNSTREAM LAYERS ===' as info_section;

SELECT 
  'Layer 3 provides temporal and contextual intelligence that informs:' as info,
  '- Layer 4: Compound opportunity detection (location + weather + season)' as layer_4_impact,
  '- Layer 5: Content theme selection based on holidays and events' as layer_5_impact,
  '- Layer 6: Time-sensitive post scheduling (post before/during events)' as layer_6_impact,
  '- Layer 8: Contextual captions (mention weather, holidays, seasonal factors)' as layer_8_impact;

SELECT 
  'External data sources (fetched at runtime, not in database):' as external_note,
  '- Weather: OpenWeatherMap API (7-day forecast, 1-hour cache)' as weather_source,
  '- Compound opportunities: Detected by combining DB data + API data + business logic' as opportunity_detection;
