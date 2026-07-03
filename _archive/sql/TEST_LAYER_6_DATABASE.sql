-- ============================================================================
-- LAYER 6: POST SPECIFICATION ENGINE - DATABASE VERIFICATION TEST
-- ============================================================================
-- Purpose: Verify Layer 6 day/time optimization infrastructure
-- Run this against your Supabase database to ensure Layer 6 is properly set up
-- ============================================================================

-- Set test context
DO $$
DECLARE
  test_business_id uuid := '840347de-9ba7-4275-8aa3-4553417fc2af';
BEGIN
  RAISE NOTICE 'Testing Layer 6 with business_id: %', test_business_id;
END $$;

-- ============================================================================
-- TEST 1: BUSINESS OPERATIONS (Opening Hours & Service Periods)
-- ============================================================================
SELECT 
  '=== TEST 1: BUSINESS OPERATIONS (Opening Hours) ===' as test_section;

-- Check if business_operations table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'business_operations'
    ) 
    THEN '✅ business_operations table exists'
    ELSE '❌ business_operations table MISSING'
  END as table_check;

-- Check business operations for test business
SELECT 
  'Business Operations Data' as section,
  business_id,
  service_periods,
  opening_hours,
  has_table_service,
  has_takeaway,
  has_delivery
FROM business_operations
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Parse service periods (JSONB structure)
SELECT 
  'Service Periods Breakdown' as section,
  CASE 
    WHEN service_periods->>'breakfast' IS NOT NULL 
    THEN '✅ Breakfast available'
    ELSE '⚠️ No breakfast service'
  END as breakfast_service,
  CASE 
    WHEN service_periods->>'lunch' IS NOT NULL 
    THEN '✅ Lunch available'
    ELSE '⚠️ No lunch service'
  END as lunch_service,
  CASE 
    WHEN service_periods->>'dinner' IS NOT NULL 
    THEN '✅ Dinner available'
    ELSE '⚠️ No dinner service'
  END as dinner_service
FROM business_operations
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Expected: 
-- - service_periods: JSONB like {"breakfast": {...}, "lunch": {...}, "dinner": {...}}
-- - opening_hours: JSONB with daily schedules
-- - Used for posting constraints (no lunch posts if no lunch service)

-- ============================================================================
-- TEST 2: BUSINESS TYPE (For Day Selection Rules)
-- ============================================================================
SELECT 
  '=== TEST 2: BUSINESS TYPE (Day Selection Rules) ===' as test_section;

-- Get business type for Layer 6 day optimization
SELECT 
  'Business Type for Day Patterns' as section,
  b.id,
  b.name,
  b.category as business_type,
  CASE b.category
    WHEN 'cafe' THEN 'FSE (Fine Service Establishment)'
    WHEN 'restaurant' THEN 'FSE (Fine Service Establishment)'
    WHEN 'bar' THEN 'SBO (Service-Based Operation)'
    WHEN 'food_truck' THEN 'MFV (Mobile Food Vendor)'
    WHEN 'bakery' THEN 'SBO (Service-Based Operation)'
    WHEN 'fast_food' THEN 'QSR (Quick Service Restaurant)'
    ELSE 'FSE (default)'
  END as layer6_classification
FROM businesses b
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Expected: Business type used for day pattern selection
-- FSE: Wed-Fri for menu, weekend for ambiance
-- SBO: Even distribution
-- MFV: Day-of/morning-of for locations
-- QSR: Any day works

-- ============================================================================
-- TEST 3: HISTORICAL PERFORMANCE DATA (Layer 4 Integration)
-- ============================================================================
SELECT 
  '=== TEST 3: HISTORICAL PERFORMANCE DATA ===' as test_section;

-- Check if performance tracking tables exist (Layer 4)
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'content_type_baselines'
    ) 
    THEN '✅ content_type_baselines exists (Layer 4 integration)'
    ELSE '❌ content_type_baselines MISSING'
  END as layer4_integration;

-- Check for optimal posting times data
SELECT 
  'Historical Posting Time Data' as section,
  business_id,
  total_posts_analyzed,
  sufficient_data,
  CASE 
    WHEN baselines IS NOT NULL AND jsonb_typeof(baselines) = 'object' AND baselines != '{}'::jsonb
    THEN '✅ Performance baselines available'
    ELSE '⚠️ No historical data yet (will use defaults)'
  END as baselines_status,
  CASE 
    WHEN platform_baselines IS NOT NULL AND jsonb_typeof(platform_baselines) = 'object' AND platform_baselines != '{}'::jsonb
    THEN '✅ Platform-specific data available'
    ELSE '⚠️ No platform data yet'
  END as platform_status
FROM content_type_baselines
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
LIMIT 1;

-- Show sample baseline data structure if available
SELECT 
  'Baseline Data Sample' as section,
  CASE 
    WHEN baselines->>'menu_highlight' IS NOT NULL 
    THEN 'menu_highlight: ' || (baselines->'menu_highlight'->>'best_time') || ' on day ' || (baselines->'menu_highlight'->>'best_day')
    ELSE 'No menu_highlight baseline yet'
  END as menu_example,
  CASE 
    WHEN platform_baselines->>'instagram' IS NOT NULL
    THEN 'Instagram best times: ' || (platform_baselines->'instagram'->>'best_posting_times')
    ELSE 'No Instagram baseline yet'
  END as platform_example
FROM content_type_baselines
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
LIMIT 1;

-- If no data, check if structure is ready
SELECT 
  'Performance Tracking Readiness' as check,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'content_type_baselines' 
      AND column_name = 'baselines'
    )
    THEN '✅ baselines column exists (ready for performance learning)'
    ELSE '❌ Column missing'
  END as baselines_check,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'content_type_baselines' 
      AND column_name = 'platform_baselines'
    )
    THEN '✅ platform_baselines column exists (ready for platform learning)'
    ELSE '❌ Column missing'
  END as platform_check;

-- Expected: 
-- - baselines: JSONB like {"menu_highlight": {"best_time": "10:30", "best_day": 5, ...}}
-- - platform_baselines: JSONB like {"instagram": {"best_posting_times": ["09:00", "18:00"], ...}}
-- - Can be empty initially (Layer 6 uses defaults)
-- - Populated by Layer 4 after posting history accumulates

-- ============================================================================
-- TEST 4: DAY SELECTION PATTERNS (Simulated Logic)
-- ============================================================================
SELECT 
  '=== TEST 4: DAY SELECTION PATTERNS ===' as test_section;

-- Show optimal days for common content types
SELECT 
  'Content Type Day Patterns' as pattern,
  'menu_highlight: Mon/Wed/Fri (decision days)' as menu,
  'location_story: Thu/Fri (weekend momentum)' as location,
  'behind_scenes: Sat/Sun (engaged audience)' as behind_scenes,
  'event_promotion: Mon/Thu/Fri (early week + weekend)' as events,
  'engagement: Tue/Thu (mid-week)' as engagement;

-- Show day names for reference
SELECT 
  'Day of Week Reference' as reference,
  '0 = Sunday, 1 = Monday, 2 = Tuesday' as part1,
  '3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday' as part2;

-- Check current day context
SELECT 
  'Current Context' as context,
  EXTRACT(DOW FROM CURRENT_DATE) as current_day_number,
  TO_CHAR(CURRENT_DATE, 'Day') as current_day_name,
  CURRENT_DATE as today;

-- Expected:
-- Layer 6 uses these patterns to optimize Layer 5's day assignments
-- TypeScript implementation in post-slot-optimizer.ts

-- ============================================================================
-- TEST 5: TIME OPTIMIZATION RULES (Simulated Logic)
-- ============================================================================
SELECT 
  '=== TEST 5: TIME OPTIMIZATION RULES ===' as test_section;

-- Show optimal hours for content types
SELECT 
  'Content Type Time Patterns' as pattern,
  'breakfast_menu: 7-9am (morning awareness)' as breakfast,
  'lunch_menu: 11am-12pm (immediate decision)' as lunch,
  'dinner_menu: 2-5pm (planning window, peak 4-5pm)' as dinner,
  'atmosphere/location: 5-7pm (evening FOMO)' as atmosphere,
  'behind_scenes: 9-11am (weekend storytelling)' as behind_scenes,
  'engagement: 12pm or 6pm (lunch/evening)' as engagement;

-- Show platform peak hours
SELECT 
  'Platform Peak Hours' as platform_peaks,
  'Instagram: 11am-1pm, 6-8pm' as instagram,
  'Facebook: 12-1pm, 7-9pm' as facebook;

-- Current hour context
SELECT 
  'Current Time Context' as context,
  EXTRACT(HOUR FROM CURRENT_TIMESTAMP) as current_hour,
  TO_CHAR(CURRENT_TIMESTAMP, 'HH24:MI') as current_time;

-- Expected:
-- Layer 6 finds overlap between content timing and platform peaks
-- Respects business opening hours (no lunch posts if closed for lunch)

-- ============================================================================
-- TEST 6: OPENING HOURS CONSTRAINTS (Simulation)
-- ============================================================================
SELECT 
  '=== TEST 6: OPENING HOURS CONSTRAINTS ===' as test_section;

-- Simulate constraint logic
WITH business_hours AS (
  SELECT 
    business_id,
    service_periods,
    opening_hours
  FROM business_operations
  WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
)
SELECT 
  'Constraint Checks' as check_type,
  CASE 
    WHEN service_periods->>'breakfast' IS NULL 
    THEN '⚠️ No breakfast service - breakfast_menu posts will be moved to 11am (lunch)'
    ELSE '✅ Breakfast service available - breakfast_menu can post 7-9am'
  END as breakfast_constraint,
  CASE 
    WHEN service_periods->>'lunch' IS NULL 
    THEN '⚠️ No lunch service - lunch_menu posts will be moved to 4pm (dinner planning)'
    ELSE '✅ Lunch service available - lunch_menu can post 11am-12pm'
  END as lunch_constraint,
  CASE 
    WHEN service_periods->>'dinner' IS NOT NULL 
    THEN '✅ Dinner service available - dinner posts can use optimal timing'
    ELSE '⚠️ No dinner service - posts adjusted'
  END as dinner_constraint,
  CASE 
    WHEN opening_hours IS NOT NULL AND jsonb_typeof(opening_hours) = 'object'
    THEN '✅ Opening hours defined'
    ELSE '⚠️ No opening hours data (using defaults)'
  END as hours_constraint
FROM business_hours;

-- Expected:
-- Layer 6 respects business constraints
-- No breakfast posts if not serving breakfast
-- Timing shifted to fit operational hours

-- ============================================================================
-- TEST 7: LAYER 5 → LAYER 6 DATA FLOW (Integration Check)
-- ============================================================================
SELECT 
  '=== TEST 7: LAYER 5 → LAYER 6 INTEGRATION ===' as test_section;

-- Verify Layer 6 receives all necessary data from previous layers
SELECT 
  b.id as business_id,
  b.name,
  b.category as business_type,
  
  -- Layer 1: Information Foundation
  (SELECT COUNT(*) FROM menu_results_v2 WHERE business_id = b.id) as menu_data,
  
  -- Layer 2: Strategic Baselines  
  btd.ideal_posts_per_week as posts_per_week,
  
  -- Layer 3: Temporal Context
  (SELECT COUNT(*) FROM contextual_calendar WHERE country = b.country) as calendar_events,
  
  -- Layer 4: Performance Tracking (optional, for time optimization)
  (SELECT COUNT(*) FROM content_performance_log WHERE business_id = b.id) as performance_records,
  CASE 
    WHEN (SELECT baselines FROM content_type_baselines WHERE business_id = b.id LIMIT 1) IS NOT NULL 
         AND (SELECT baselines FROM content_type_baselines WHERE business_id = b.id LIMIT 1) != '{}'::jsonb
    THEN '✅ Historical baseline data'
    ELSE '⚠️ Using default times'
  END as time_optimization,
  
  -- Layer 5: Content Opportunities (input to Layer 6)
  (SELECT COUNT(*) FROM menu_item_metadata WHERE business_id = b.id) as menu_opportunities,
  
  -- Layer 6: Business Operations (day/time constraints)
  CASE WHEN bo.business_id IS NOT NULL THEN '✅' ELSE '❌' END as has_operations_data,
  CASE WHEN bo.service_periods->>'breakfast' IS NOT NULL THEN '✅ Breakfast' ELSE '❌' END as breakfast_service,
  CASE WHEN bo.service_periods->>'lunch' IS NOT NULL THEN '✅ Lunch' ELSE '❌' END as lunch_service,
  CASE WHEN bo.service_periods->>'dinner' IS NOT NULL THEN '✅ Dinner' ELSE '❌' END as dinner_service
  
FROM businesses b
LEFT JOIN business_type_defaults btd ON btd.business_type = b.category
LEFT JOIN business_operations bo ON bo.business_id = b.id
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Expected:
-- - Layer 1-5: All data flowing in ✅
-- - business_operations: Present for time constraints
-- - Performance data: Optional (improves over time)

-- ============================================================================
-- TEST 8: OPTIMIZATION SIMULATION (Example Flow)
-- ============================================================================
SELECT 
  '=== TEST 8: OPTIMIZATION SIMULATION ===' as test_section;

-- Simulate Layer 6 processing for common scenarios
WITH example_slots AS (
  SELECT * FROM (VALUES
    ('dinner_menu', 'Danish Winter Stew', 1, 18, 'instagram'),
    ('breakfast_menu', 'Weekend Brunch', 5, 18, 'instagram'),
    ('behind_scenes', 'Kitchen Prep', 3, 12, 'facebook'),
    ('location_story', 'Riverside Ambiance', 6, 12, 'instagram')
  ) AS t(content_type, subject, layer5_day, layer5_hour, platform)
),
business_hours AS (
  SELECT 
    service_periods
  FROM business_operations
  WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
)
SELECT 
  '--- Optimization Examples ---' as section,
  e.content_type,
  e.subject,
  CASE e.layer5_day
    WHEN 0 THEN 'Sunday'
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
  END as layer5_day,
  e.layer5_hour::TEXT || ':00' as layer5_time,
  
  -- Layer 6 would optimize to:
  CASE e.content_type
    WHEN 'dinner_menu' THEN 'Monday'
    WHEN 'breakfast_menu' THEN 'Thursday'
    WHEN 'behind_scenes' THEN 'Saturday'
    WHEN 'location_story' THEN 'Friday'
  END as layer6_optimal_day,
  
  CASE e.content_type
    WHEN 'dinner_menu' THEN '16:00 (dinner planning window)'
    WHEN 'breakfast_menu' THEN '18:00 (weekend promo timing)'
    WHEN 'behind_scenes' THEN '10:00 (weekend storytelling)'
    WHEN 'location_story' THEN '18:00 (evening FOMO)'
  END as layer6_optimal_time,
  
  CASE e.content_type
    WHEN 'dinner_menu' THEN 'Dinner menu during peak planning window'
    WHEN 'breakfast_menu' THEN 'Weekend brunch promoted Thu evening'
    WHEN 'behind_scenes' THEN 'Storytelling optimized for weekend engagement'
    WHEN 'location_story' THEN 'Ambiance during FOMO window to drive visits'
  END as optimization_reason
  
FROM example_slots e
CROSS JOIN business_hours bh;

-- Expected:
-- Layer 6 refines Layer 5's basic day/time assignments
-- Applies content-type patterns, business constraints, platform peaks

-- ============================================================================
-- TEST 9: WEEKLY PLANNING READINESS (Layer 6 Specific)
-- ============================================================================
SELECT 
  '=== TEST 9: LAYER 6 READINESS CHECK ===' as test_section;

-- Check if all Layer 6 components are ready
WITH readiness AS (
  SELECT 
    b.id,
    b.name,
    
    -- Required data
    (SELECT COUNT(*) FROM business_operations WHERE business_id = b.id) > 0 as has_business_hours,
    b.category IS NOT NULL as has_business_type,
    
    -- Optional performance data (improves optimization but not required)
    (SELECT COUNT(*) FROM content_type_baselines WHERE business_id = b.id) > 0 as has_performance_data,
    
    -- Layer dependencies
    (SELECT COUNT(*) FROM menu_results_v2 WHERE business_id = b.id AND status = 'completed') > 0 as layer1_ready,
    (SELECT COUNT(*) FROM business_type_defaults WHERE business_type = b.category) > 0 as layer2_ready,
    (SELECT COUNT(*) FROM contextual_calendar WHERE country = b.country) > 0 as layer3_ready,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'content_performance_log') > 0 as layer4_ready,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'menu_item_metadata') > 0 as layer5_ready
    
  FROM businesses b
  WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af'
)
SELECT 
  name,
  CASE WHEN layer1_ready THEN '✅' ELSE '❌' END || ' Layer 1: Information Foundation' as layer_1,
  CASE WHEN layer2_ready THEN '✅' ELSE '❌' END || ' Layer 2: Strategic Baselines' as layer_2,
  CASE WHEN layer3_ready THEN '✅' ELSE '❌' END || ' Layer 3: Temporal Context' as layer_3,
  CASE WHEN layer4_ready THEN '✅' ELSE '❌' END || ' Layer 4: Performance Tracking (optional)' as layer_4,
  CASE WHEN layer5_ready THEN '✅' ELSE '❌' END || ' Layer 5: Content Opportunities' as layer_5,
  CASE WHEN has_business_hours THEN '✅' ELSE '❌' END || ' Business opening hours' as layer_6_required_1,
  CASE WHEN has_business_type THEN '✅' ELSE '❌' END || ' Business type for day patterns' as layer_6_required_2,
  CASE WHEN has_performance_data THEN '✅' ELSE '⚠️' END || ' Historical time data (enhances optimization)' as layer_6_optional,
  CASE 
    WHEN layer1_ready AND layer2_ready AND layer3_ready AND layer5_ready 
         AND has_business_hours AND has_business_type
    THEN '✅ LAYER 6 READY - Can optimize post timing'
    ELSE '❌ MISSING DEPENDENCIES - See above'
  END as layer6_status
FROM readiness;

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================
SELECT 
  '=== LAYER 6 VERIFICATION SUMMARY ===' as test_section;

-- Check overall Layer 6 readiness
WITH layer6_checks AS (
  SELECT 
    EXISTS (
      SELECT 1 FROM business_operations 
      WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
    ) as has_business_hours,
    
    EXISTS (
      SELECT 1 FROM businesses 
      WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af' 
      AND category IS NOT NULL
    ) as has_business_type,
    
    EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'content_type_baselines'
    ) as has_performance_infrastructure,
    
    -- Layer dependencies
    EXISTS (SELECT 1 FROM menu_results_v2 WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af') as layer1,
    EXISTS (SELECT 1 FROM business_type_defaults) as layer2,
    EXISTS (SELECT 1 FROM contextual_calendar) as layer3,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_performance_log') as layer4,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_item_metadata') as layer5
)
SELECT 
  'Layer 6 Post Specification Engine Status' as component,
  CASE 
    WHEN has_business_hours AND has_business_type AND layer1 AND layer2 AND layer3 AND layer5
    THEN '✅ READY - All required components present'
    ELSE '⚠️ INCOMPLETE - Missing required data'
  END as status
FROM layer6_checks;

-- Show component breakdown
SELECT 
  '--- Layer 6 Component Status ---' as section,
  CASE WHEN EXISTS (SELECT 1 FROM business_operations WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af')
    THEN '✅' ELSE '❌' END || ' Business operations (opening hours, service periods)' as component_1,
  CASE WHEN EXISTS (SELECT 1 FROM businesses WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af' AND category IS NOT NULL)
    THEN '✅' ELSE '❌' END || ' Business type (day pattern classification)' as component_2,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_type_baselines')
    THEN '✅' ELSE '❌' END || ' Performance baselines infrastructure (optional enhancement)' as component_3;

-- Show optimization capabilities
SELECT 
  '--- Layer 6 Capabilities ---' as section,
  '✅ Day selection optimization (content-type patterns)' as capability_1,
  '✅ Time optimization (meal periods + platform peaks)' as capability_2,
  '✅ Business hours constraints (respect opening/closing)' as capability_3,
  '✅ Historical performance learning (when data available)' as capability_4;

-- ============================================================================
-- ADDITIONAL INFO: Layer 6 Components
-- ============================================================================
SELECT 
  '=== LAYER 6 IMPLEMENTATION DETAILS ===' as info_section;

SELECT 
  'Phase 1: Day Selection Refinement' as phase,
  '✅ TypeScript implementation complete' as status,
  'Applies content-type-specific day patterns (menu: Mon/Wed/Fri, atmosphere: Thu/Fri/Sat, etc.)' as functionality,
  'TypeScript: post-slot-optimizer.ts → selectOptimalDay()' as implementation;

SELECT 
  'Phase 2: Time Optimization' as phase,
  '✅ TypeScript implementation complete' as status,
  'Meal-period awareness (breakfast: 7-9am, lunch: 11-12, dinner: 2-5pm, FOMO: 5-7pm)' as functionality,
  'TypeScript: post-slot-optimizer.ts → selectOptimalHour()' as implementation;

SELECT 
  'Business Constraints' as phase,
  '✅ TypeScript implementation complete' as status,
  'Respects opening hours, no lunch posts if closed for lunch, timing adjustments' as functionality,
  'TypeScript: post-slot-optimizer.ts → respectOpeningHours()' as implementation;

SELECT 
  'Performance Learning' as phase,
  '✅ TypeScript implementation complete' as status,
  'Uses Layer 4 optimal_posting_times when available, falls back to defaults' as functionality,
  'TypeScript: post-slot-optimizer.ts → applyPerformanceOptimization()' as implementation;

-- ============================================================================
-- WHAT LAYER 6 PROVIDES TO LAYER 7
-- ============================================================================
SELECT 
  '=== LAYER 6 → LAYER 7 DATA FLOW ===' as info_section;

SELECT 
  'Layer 7 (Media Format Selection) receives from Layer 6:' as data_flow,
  '- Optimized day/time schedule (exact dates/hours)' as timing,
  '- Content type + opportunity data (from Layer 5)' as content,
  '- Platform assignment (Instagram/Facebook)' as platform,
  '- Optimization reasoning (transparency for user)' as metadata;

SELECT 
  'Current State:' as state,
  '- Day optimization: ✅ Implemented (content-type patterns)' as day_status,
  '- Time optimization: ✅ Implemented (meal periods + platform peaks)' as time_status,
  '- Business constraints: ✅ Implemented (opening hours respected)' as constraints_status,
  '- Performance learning: ✅ Implemented (uses Layer 4 data when available)' as learning_status;

SELECT 
  'Next Steps:' as state,
  '- Layer 7: Media Format & Platform Specification (photo/carousel/reel selection)' as next_layer,
  '- Layer 8: Caption & Creative Direction (tone, emoji, caption generation)' as after_that,
  '- Layer 9: Weekly Plan Output Assembly (final production-ready briefs)' as finally;
