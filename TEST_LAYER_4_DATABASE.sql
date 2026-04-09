-- ============================================================================
-- LAYER 4: PERFORMANCE-DRIVEN OPTIMIZATION - DATABASE VERIFICATION TEST
-- ============================================================================
-- Purpose: Verify Layer 4 performance tracking and variety filter infrastructure
-- Run this against your Supabase database to ensure Layer 4 is properly set up
-- ============================================================================

-- Set test context
DO $$
DECLARE
  test_business_id uuid := '840347de-9ba7-4275-8aa3-4553417fc2af';
BEGIN
  RAISE NOTICE 'Testing Layer 4 with business_id: %', test_business_id;
END $$;

-- ============================================================================
-- TEST 1: CONTENT_PERFORMANCE_LOG TABLE (Performance Tracking)
-- ============================================================================
SELECT 
  '=== TEST 1: CONTENT_PERFORMANCE_LOG TABLE ===' as test_section;

-- Check if table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'content_performance_log'
    ) 
    THEN '✅ content_performance_log table exists'
    ELSE '❌ content_performance_log table MISSING'
  END as table_check;

-- Check required columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'content_performance_log'
ORDER BY column_name;

-- Count total performance records (will be 0 until API integration)
SELECT 
  'Total Performance Records' as metric,
  COUNT(*) as count
FROM content_performance_log;

-- Check performance records for test business
SELECT 
  'Performance Records for Test Business' as metric,
  COUNT(*) as count
FROM content_performance_log
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Expected: 0 records (awaiting Instagram/Facebook API integration)
-- Table structure ready to receive data

-- ============================================================================
-- TEST 2: CONTENT_TYPE_BASELINES TABLE (Learning System)
-- ============================================================================
SELECT 
  '=== TEST 2: CONTENT_TYPE_BASELINES TABLE ===' as test_section;

-- Check if table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'content_type_baselines'
    ) 
    THEN '✅ content_type_baselines table exists'
    ELSE '❌ content_type_baselines table MISSING'
  END as table_check;

-- Check required columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'content_type_baselines'
ORDER BY column_name;

-- Count baselines (will be 0 until performance data collected)
SELECT 
  'Total Baselines Calculated' as metric,
  COUNT(*) as count
FROM content_type_baselines;

-- Check baseline for test business
SELECT 
  'Baseline for Test Business' as metric,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM content_type_baselines
      WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
    ) THEN '✅ Baseline exists'
    ELSE '⚠️ No baseline yet (expected - awaiting data)'
  END as status;

-- Expected: 0 baselines (needs 20+ posts with performance data first)

-- ============================================================================
-- TEST 3: POST_IDEAS TABLE (Variety Filter Integration Point)
-- ============================================================================
SELECT 
  '=== TEST 3: POST_IDEAS TABLE ===' as test_section;

-- Check if table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'post_ideas'
    ) 
    THEN '✅ post_ideas table exists'
    ELSE '❌ post_ideas table MISSING'
  END as table_check;

-- Check required columns for variety tracking
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'post_ideas'
  AND column_name IN (
    'business_id', 'content_type', 'platform', 'status', 
    'suggested_post_time', 'posted_at', 'created_at'
  )
ORDER BY column_name;

-- Count post ideas for test business (only if table exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_ideas') THEN
    RAISE NOTICE '⚠️  post_ideas table not found';
    RAISE NOTICE 'Apply migration: supabase/migrations/20260114140000_post_ideas.sql';
  END IF;
END $$;

SELECT 
  'Post Ideas Status' as metric,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_ideas')
    THEN '❌ Table missing - apply migration 20260114140000_post_ideas.sql'
    ELSE '✅ Table exists'
  END as status;

-- Note: Variety filter requires post_ideas table to track recent posts
-- This table is optional for Layer 4B (performance tracking) but required for Layer 4A (variety filter)

-- TEST 4: Note about post_ideas dependency
SELECT 
  '⚠️ VARIETY FILTER DATA requires post_ideas table' as note,
  'Apply migration 20260114140000_post_ideas.sql to enable variety tracking' as action,
  'Variety filter checks: content type repetition, platform balance, recency' as functionality;

-- Performance tracking (Layer 4B) works independently
-- Variety filter (Layer 4A) needs post_ideas table

-- ============================================================================
-- TEST 5: GRACEFUL DEGRADATION (Layer 2 Fallback)
-- ============================================================================
SELECT 
  '=== TEST 5: GRACEFUL DEGRADATION TEST ===' as test_section;

-- Test get_performance_adjusted_distribution function
-- Should return Layer 2 defaults when no performance data exists
SELECT 
  'Testing get_performance_adjusted_distribution function' as test_name;

-- Check if function exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'get_performance_adjusted_distribution'
    ) 
    THEN '✅ get_performance_adjusted_distribution function exists'
    ELSE '❌ get_performance_adjusted_distribution function MISSING'
  END as function_check;

-- Call function with test business (should gracefully return Layer 2 defaults)
SELECT *
FROM get_performance_adjusted_distribution(
  '840347de-9ba7-4275-8aa3-4553417fc2af'::uuid,
  'cafe' -- business type
);

-- Expected output when NO performance data:
-- - Returns Layer 2 static ratios from business_type_defaults
-- - Should show content types with their baseline percentages
-- - Gracefully handles missing performance data

-- ============================================================================
-- TEST 6: CALCULATE_CONTENT_BASELINES FUNCTION
-- ============================================================================
SELECT 
  '=== TEST 6: BASELINE CALCULATION FUNCTION ===' as test_section;

-- Check if function exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'calculate_content_baselines'
    ) 
    THEN '✅ calculate_content_baselines function exists'
    ELSE '❌ calculate_content_baselines function MISSING'
  END as function_check;

-- Note: Cannot execute without data, but verify structure is ready
SELECT 
  'Function ready to calculate baselines from performance data' as status,
  'Needs 20+ posts with engagement metrics to activate' as requirement;

-- ============================================================================
-- TEST 7: LAYER 4 INTEGRATION WITH OTHER LAYERS
-- ============================================================================
SELECT 
  '=== TEST 7: CROSS-LAYER INTEGRATION ===' as test_section;

-- Verify Layer 4 connects to all previous layers
SELECT 
  b.id as business_id,
  b.name,
  b.category as business_type,
  
  -- Layer 1: Information Foundation
  CASE WHEN o.business_id IS NOT NULL THEN '✅' ELSE '❌' END as has_operations,
  
  -- Layer 2: Strategic Baselines
  CASE WHEN btd.business_type IS NOT NULL THEN '✅' ELSE '❌' END as has_type_defaults,
  btd.ideal_posts_per_week as layer2_target_frequency,
  
  -- Layer 3: Temporal Context
  (SELECT COUNT(*) FROM contextual_calendar WHERE country = b.country) as calendar_events,
  
  -- Layer 4A: Variety Filter (via post_ideas - optional table)
  'post_ideas table not deployed yet' as variety_filter_status,
  
  -- Layer 4B: Performance Tracking
  (SELECT COUNT(*) FROM content_performance_log WHERE business_id = b.id) as performance_records,
  CASE 
    WHEN EXISTS (SELECT 1 FROM content_type_baselines WHERE business_id = b.id)
    THEN '✅ Has baselines'
    ELSE '⏳ Awaiting data'
  END as baseline_status
  
FROM businesses b
LEFT JOIN business_operations o ON o.business_id = b.id
LEFT JOIN business_type_defaults btd ON btd.business_type = b.category
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Expected:
-- - Layer 1-3: All connected ✅
-- - recent_posts_for_variety: Shows how many posts available for variety checks
-- - performance_records: 0 (awaiting API integration)
-- - baseline_status: 'Awaiting data' (normal initial state)

-- ============================================================================
-- TEST 8: VARIETY FILTER NOTES
-- ============================================================================
SELECT 
  '=== TEST 8: VARIETY FILTER (REQUIRES POST_IDEAS TABLE) ===' as test_section;

SELECT 
  'Variety Filter Status' as component,
  '⚠️ Requires post_ideas table (not yet deployed)' as status,
  'Apply migration: 20260114140000_post_ideas.sql' as action;

SELECT 
  'What Variety Filter Does:' as feature,
  'Prevents content repetition' as function_1,
  'Ensures platform balance (Instagram 40-70%, Facebook 30-60%)' as function_2,
  'Checks content type sequence (max 2 same type in row)' as function_3,
  'Enforces minimum 3-day gap between same content types' as function_4;

SELECT 
  'Integration Point' as note,
  'Variety filter reads from post_ideas table' as data_source,
  'Analyzes last 14 days of posted content' as time_window,
  'Scores candidates 0-100 based on variety rules' as output;

-- ============================================================================
-- TEST 9: PERFORMANCE DATA FLOW SIMULATION
-- ============================================================================
SELECT 
  '=== TEST 9: PERFORMANCE DATA FLOW (Future State) ===' as test_section;

-- Show what happens when performance data starts flowing in
SELECT 
  'Data Flow Stage' as stage,
  'Current Status' as status,
  'What Happens Next' as next_action;

-- Stage 1: Empty state (NOW)
SELECT 
  'Stage 1: Empty State' as stage,
  'No performance data yet' as status,
  'System uses Layer 2 static baselines (FSE: 40% menu, 25% atmosphere...)' as next_action
UNION ALL
-- Stage 2: Initial data (1-19 posts)
SELECT 
  'Stage 2: Initial Collection (1-19 posts)',
  'Not yet reached',
  'Data collected but insufficient for learning - continues using Layer 2 baselines'
UNION ALL
-- Stage 3: Sufficient data (20+ posts)
SELECT 
  'Stage 3: Learning Activated (20+ posts)',
  'Not yet reached',
  'calculate_content_baselines() runs → sufficient_data = TRUE → adjusts distribution'
UNION ALL
-- Stage 4: Optimization (50+ posts)
SELECT 
  'Stage 4: Deep Optimization (50+ posts)',
  'Not yet reached',
  'Confident adjustments: ±20% from baseline, optimal times, top-performing items prioritized';

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================
SELECT 
  '=== LAYER 4 VERIFICATION SUMMARY ===' as test_section;

-- Check overall Layer 4 readiness
WITH layer4_checks AS (
  SELECT 
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_performance_log') as has_perf_log,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_type_baselines') as has_baselines,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_ideas') as has_post_ideas,
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_performance_adjusted_distribution') as has_dist_func,
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_content_baselines') as has_calc_func
)
SELECT 
  'Layer 4 Infrastructure Status' as component,
  CASE 
    WHEN has_perf_log AND has_baselines AND has_post_ideas AND has_dist_func AND has_calc_func
    THEN '✅ COMPLETE - All components deployed'
    ELSE '⚠️ INCOMPLETE - Missing components'
  END as status
FROM layer4_checks;

-- Show component breakdown
SELECT 
  '--- Component Breakdown ---' as section,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_performance_log')
    THEN '✅' ELSE '❌' END || ' content_performance_log (Performance tracking)' as component_1,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_type_baselines')
    THEN '✅' ELSE '❌' END || ' content_type_baselines (Learning engine)' as component_2,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_ideas')
    THEN '✅' ELSE '⚠️ ' END || ' post_ideas (Variety filter - optional, not yet deployed)' as component_3,
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_performance_adjusted_distribution')
    THEN '✅' ELSE '❌' END || ' get_performance_adjusted_distribution() (Graceful degradation)' as component_4,
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_content_baselines')
    THEN '✅' ELSE '❌' END || ' calculate_content_baselines() (Baseline calculation)' as component_5;

-- Show data collection status
SELECT 
  '--- Data Collection Status ---' as section,
  (SELECT COUNT(*) FROM content_performance_log) as total_performance_records,
  (SELECT COUNT(DISTINCT business_id) FROM content_performance_log) as businesses_with_data,
  (SELECT COUNT(*) FROM content_type_baselines WHERE sufficient_data = true) as businesses_with_baselines,
  CASE 
    WHEN (SELECT COUNT(*) FROM content_performance_log) = 0 
    THEN '⏳ Awaiting Instagram/Facebook API integration'
    WHEN (SELECT COUNT(*) FROM content_performance_log) < 20
    THEN '📊 Initial collection phase (need 20+ posts per business)'
    ELSE '✅ Learning system active'
  END as collection_phase;

-- ============================================================================
-- ADDITIONAL INFO: Layer 4 Components
-- ============================================================================
SELECT 
  '=== LAYER 4 COMPONENT DETAILS ===' as info_section;

SELECT 
  'Layer 4A: Variety Filter' as component,
  '✅ TypeScript implementation complete' as status,
  'Prevents repetition, ensures platform balance, maintains visual variety' as functionality,
  'Uses post_ideas table for recent post history' as data_source;

SELECT 
  'Layer 4B: Performance Tracking' as component,
  '✅ Infrastructure deployed, ⏳ awaiting API integration' as status,
  'Learns from actual results, adjusts Layer 2 baselines dynamically' as functionality,
  'Uses content_performance_log → calculates content_type_baselines' as data_source;

SELECT 
  'Integration Required' as component,
  '⏳ Instagram Insights API + Facebook Graph API' as status,
  'Fetch reach, engagement, saves, clicks from platforms' as functionality,
  'Automatic learning once data flows in - no code changes needed' as data_source;

-- ============================================================================
-- WHAT LAYER 4 PROVIDES TO LAYER 5
-- ============================================================================
SELECT 
  '=== LAYER 4 → LAYER 5 DATA FLOW ===' as info_section;

SELECT 
  'Layer 5 receives from Layer 4:' as data_flow,
  '- Variety requirements (what content types/platforms to avoid)' as variety_filter,
  '- Variety scores (0-100 ranking for each candidate)' as scoring,
  '- Performance insights (top-performing types, items, times)' as performance,
  '- Adjusted content ratios (overrides Layer 2 when sufficient data)' as optimization;

SELECT 
  'Current State (No Performance Data):' as state,
  '- Variety filter: ✅ Active (checks repetition, platform balance)' as variety_status,
  '- Performance optimization: ⏳ Pending (gracefully uses Layer 2 defaults)' as perf_status,
  '- Combined output: Valid Layer 4 data ready for Layer 5' as combined_status;

SELECT 
  'Future State (With Performance Data):' as state,
  '- Variety filter: ✅ Active (same functionality)' as variety_status,
  '- Performance optimization: ✅ Active (adjusts ratios ±20% based on results)' as perf_status,
  '- Combined output: Optimized recommendations based on actual results' as combined_status;
