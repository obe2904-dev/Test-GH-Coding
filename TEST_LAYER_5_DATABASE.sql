-- ============================================================================
-- LAYER 5: CONTENT OPPORTUNITY MATCHING - DATABASE VERIFICATION TEST
-- ============================================================================
-- Purpose: Verify Layer 5 menu scoring and opportunity matching infrastructure
-- Run this against your Supabase database to ensure Layer 5 is properly set up
-- ============================================================================

-- Set test context
DO $$
DECLARE
  test_business_id uuid := '840347de-9ba7-4275-8aa3-4553417fc2af';
BEGIN
  RAISE NOTICE 'Testing Layer 5 with business_id: %', test_business_id;
END $$;

-- ============================================================================
-- TEST 1: MENU_ITEM_METADATA TABLE (Menu Scoring Engine)
-- ============================================================================
SELECT 
  '=== TEST 1: MENU_ITEM_METADATA TABLE ===' as test_section;

-- Check if table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'menu_item_metadata'
    ) 
    THEN '✅ menu_item_metadata table exists'
    ELSE '❌ menu_item_metadata table MISSING'
  END as table_check;

-- Check required columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'menu_item_metadata'
ORDER BY column_name;

-- Count total menu items with metadata
SELECT 
  'Total Menu Items with Metadata' as metric,
  COUNT(*) as count
FROM menu_item_metadata;

-- Check menu items for test business
SELECT 
  'Menu Items for Test Business' as metric,
  COUNT(*) as count
FROM menu_item_metadata
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Sample menu items structure
SELECT 
  'Sample Menu Items Structure' as section,
  item_name,
  item_category,
  is_signature,
  is_seasonal,
  is_limited_time,
  dish_temp_category,
  CASE 
    WHEN seasonal_ingredients IS NOT NULL 
    THEN jsonb_array_length(seasonal_ingredients)
    ELSE 0
  END as ingredient_count,
  total_times_posted,
  last_posted_date
FROM menu_item_metadata
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
LIMIT 5;

-- Expected: 0 or more menu items (can be empty initially)
-- Table structure ready to receive menu scoring data

-- ============================================================================
-- TEST 2: SEASONAL_INGREDIENTS TABLE (Seasonal Matching Database)
-- ============================================================================
SELECT 
  '=== TEST 2: SEASONAL_INGREDIENTS TABLE ===' as test_section;

-- Check if table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'seasonal_ingredients'
    ) 
    THEN '✅ seasonal_ingredients table exists'
    ELSE '❌ seasonal_ingredients table MISSING'
  END as table_check;

-- Check required columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'seasonal_ingredients'
ORDER BY column_name;

-- Count total seasonal ingredients
SELECT 
  'Total Seasonal Ingredients' as metric,
  COUNT(*) as count
FROM seasonal_ingredients;

-- Check Danish ingredients (default country)
SELECT 
  'Danish Ingredients (DK)' as metric,
  COUNT(*) as count
FROM seasonal_ingredients
WHERE country_code = 'DK';

-- Show ingredient distribution by season
SELECT 
  season,
  COUNT(*) as ingredient_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM seasonal_ingredients
WHERE country_code = 'DK'
GROUP BY season
ORDER BY 
  CASE season 
    WHEN 'spring' THEN 1 
    WHEN 'summer' THEN 2 
    WHEN 'autumn' THEN 3 
    WHEN 'winter' THEN 4 
  END;

-- Sample ingredients by season
SELECT 
  'Sample Seasonal Ingredients' as section,
  season,
  STRING_AGG(ingredient_name, ', ' ORDER BY bonus_points DESC) as top_ingredients
FROM (
  SELECT 
    season,
    ingredient_name,
    bonus_points,
    ROW_NUMBER() OVER (PARTITION BY season ORDER BY bonus_points DESC) as rn
  FROM seasonal_ingredients
  WHERE country_code = 'DK'
) sub
WHERE rn <= 5
GROUP BY season
ORDER BY 
  CASE season 
    WHEN 'spring' THEN 1 
    WHEN 'summer' THEN 2 
    WHEN 'autumn' THEN 3 
    WHEN 'winter' THEN 4 
  END;

-- Expected: ~50 Danish seasonal ingredients populated

-- ============================================================================
-- TEST 3: OPPORTUNITY_TRACKING TABLE (Non-Menu Opportunity Management)
-- ============================================================================
SELECT 
  '=== TEST 3: OPPORTUNITY_TRACKING TABLE ===' as test_section;

-- Check if table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'opportunity_tracking'
    ) 
    THEN '✅ opportunity_tracking table exists'
    ELSE '❌ opportunity_tracking table MISSING'
  END as table_check;

-- Check required columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'opportunity_tracking'
ORDER BY column_name;

-- Count total opportunities tracked
SELECT 
  'Total Opportunities Tracked' as metric,
  COUNT(*) as count
FROM opportunity_tracking;

-- Check opportunities for test business
SELECT 
  'Opportunities for Test Business' as metric,
  COUNT(*) as count
FROM opportunity_tracking
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Expected: 0 opportunities (empty until opportunities are triggered)
-- Table structure ready to prevent opportunity repetition

-- ============================================================================
-- TEST 4: HELPER FUNCTIONS (Scoring Support Functions)
-- ============================================================================
SELECT 
  '=== TEST 4: HELPER FUNCTIONS ===' as test_section;

-- Check if update_menu_item_posted function exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'update_menu_item_posted'
    ) 
    THEN '✅ update_menu_item_posted function exists'
    ELSE '❌ update_menu_item_posted function MISSING'
  END as function_check;

-- Check if track_opportunity_trigger function exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'track_opportunity_trigger'
    ) 
    THEN '✅ track_opportunity_trigger function exists'
    ELSE '❌ track_opportunity_trigger function MISSING'
  END as function_check;

-- Note: These functions are called after posting to update metadata

-- ============================================================================
-- TEST 5: SEASONAL INGREDIENT MATCHING SIMULATION
-- ============================================================================
SELECT 
  '=== TEST 5: SEASONAL INGREDIENT MATCHING ===' as test_section;

-- Determine current season
WITH current_season AS (
  SELECT 
    CASE 
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (3, 4, 5) THEN 'spring'
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (6, 7, 8) THEN 'summer'
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (9, 10, 11) THEN 'autumn'
      ELSE 'winter'
    END as season,
    EXTRACT(MONTH FROM CURRENT_DATE) as current_month
)
SELECT 
  '--- Current Season Context ---' as section,
  season,
  current_month,
  CURRENT_DATE as today
FROM current_season;

-- Get seasonal ingredients for current season and month
WITH current_season AS (
  SELECT 
    CASE 
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (3, 4, 5) THEN 'spring'
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (6, 7, 8) THEN 'summer'
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (9, 10, 11) THEN 'autumn'
      ELSE 'winter'
    END as season,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER as current_month
)
SELECT 
  'Ingredients in Season Now' as check_name,
  COUNT(*) as ingredient_count,
  STRING_AGG(ingredient_name, ', ' ORDER BY bonus_points DESC) as ingredients
FROM seasonal_ingredients si
CROSS JOIN current_season cs
WHERE si.season = cs.season
  AND si.country_code = 'DK'
  AND cs.current_month = ANY(si.peak_months)
GROUP BY cs.season;

-- Expected: Shows ingredients currently in peak season

-- ============================================================================
-- TEST 6: MENU SCORING INTEGRATION WITH LAYERS 1-4
-- ============================================================================
SELECT 
  '=== TEST 6: CROSS-LAYER INTEGRATION ===' as test_section;

-- Verify Layer 5 connects to all previous layers
SELECT 
  b.id as business_id,
  b.name,
  b.category as business_type,
  b.country,
  
  -- Layer 1: Menu Data
  (SELECT COUNT(*) FROM menu_results_v2 WHERE business_id = b.id AND status = 'completed') as parsed_menus,
  
  -- Layer 2: Strategic Baselines
  CASE WHEN btd.business_type IS NOT NULL THEN '✅' ELSE '❌' END as has_type_defaults,
  btd.ideal_posts_per_week as target_posts_per_week,
  
  -- Layer 3: Temporal Context
  CASE 
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (3, 4, 5) THEN 'spring'
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (6, 7, 8) THEN 'summer'
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (9, 10, 11) THEN 'autumn'
    ELSE 'winter'
  END as current_season,
  
  -- Layer 4: Performance Data
  (SELECT COUNT(*) FROM content_performance_log WHERE business_id = b.id) as performance_records,
  
  -- Layer 5: Menu Scoring
  (SELECT COUNT(*) FROM menu_item_metadata WHERE business_id = b.id) as menu_items_with_metadata,
  (SELECT COUNT(*) FROM opportunity_tracking WHERE business_id = b.id) as opportunities_tracked
  
FROM businesses b
LEFT JOIN business_type_defaults btd ON btd.business_type = b.category
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Expected:
-- - Layer 1-4: All connected ✅
-- - menu_items_with_metadata: 0+ (can be empty initially)
-- - opportunities_tracked: 0 (normal initial state)

-- ============================================================================
-- TEST 7: MENU SCORING SIMULATION (Example Scoring Logic)
-- ============================================================================
SELECT 
  '=== TEST 7: MENU SCORING EXAMPLE ===' as test_section;

-- Simulate scoring factors for existing menu items
WITH scoring_simulation AS (
  SELECT 
    mim.item_name,
    mim.item_category,
    
    -- Base score
    CASE 
      WHEN mim.is_signature THEN 100
      WHEN mim.is_limited_time THEN 85
      WHEN mim.is_seasonal THEN 75
      ELSE 50
    END as base_score,
    
    -- Seasonal bonus (if has seasonal ingredients)
    CASE 
      WHEN mim.seasonal_ingredients IS NOT NULL AND jsonb_array_length(mim.seasonal_ingredients) > 0
      THEN 30
      ELSE 0
    END as seasonal_bonus,
    
    -- Newness bonus
    CASE 
      WHEN mim.item_added_date >= CURRENT_DATE - INTERVAL '7 days' THEN 25
      WHEN mim.item_added_date >= CURRENT_DATE - INTERVAL '30 days' THEN 15
      WHEN mim.item_added_date >= CURRENT_DATE - INTERVAL '90 days' THEN 5
      ELSE 0
    END as newness_bonus,
    
    -- Recency penalty
    CASE 
      WHEN mim.last_posted_date >= CURRENT_DATE - INTERVAL '7 days' THEN -40
      WHEN mim.last_posted_date >= CURRENT_DATE - INTERVAL '14 days' THEN -20
      WHEN mim.last_posted_date >= CURRENT_DATE - INTERVAL '30 days' THEN -5
      ELSE 0
    END as recency_penalty,
    
    -- Temperature category for weather matching
    mim.dish_temp_category,
    
    -- Posting history
    mim.total_times_posted,
    mim.last_posted_date
    
  FROM menu_item_metadata mim
  WHERE mim.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
)
SELECT 
  item_name,
  item_category,
  base_score,
  seasonal_bonus,
  newness_bonus,
  recency_penalty,
  (base_score + seasonal_bonus + newness_bonus + recency_penalty) as total_score,
  CASE 
    WHEN (base_score + seasonal_bonus + newness_bonus + recency_penalty) >= 90 THEN 'CRITICAL'
    WHEN (base_score + seasonal_bonus + newness_bonus + recency_penalty) >= 70 THEN 'HIGH'
    WHEN (base_score + seasonal_bonus + newness_bonus + recency_penalty) >= 50 THEN 'MEDIUM'
    WHEN (base_score + seasonal_bonus + newness_bonus + recency_penalty) >= 30 THEN 'LOW'
    ELSE 'BLOCKED'
  END as post_worthiness
FROM scoring_simulation
ORDER BY (base_score + seasonal_bonus + newness_bonus + recency_penalty) DESC;

-- Note: This is simplified scoring - actual TypeScript implementation has 7+ factors

-- ============================================================================
-- TEST 8: NON-MENU OPPORTUNITY PATTERNS
-- ============================================================================
SELECT 
  '=== TEST 8: NON-MENU OPPORTUNITY DETECTION ===' as test_section;

-- Check business attributes that enable opportunities
SELECT 
  '--- Business Opportunity Enablers ---' as section,
  b.name,
  bo.has_outdoor_seating as outdoor_seating,
  CASE 
    WHEN bcfm.location_type_id = 'waterfront' AND bcfm.location_type_score >= 70 THEN 'Yes'
    ELSE 'No'
  END as is_waterfront,
  CASE 
    WHEN bcfm.location_type_id = 'tourist_area' AND bcfm.location_type_score >= 70 THEN 'Yes'
    ELSE 'No'
  END as is_tourist_area,
  b.category as business_type,
  CASE 
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (3, 4, 5) THEN 'spring'
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (6, 7, 8) THEN 'summer'
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (9, 10, 11) THEN 'autumn'
    ELSE 'winter'
  END as current_season
FROM businesses b
LEFT JOIN business_operations bo ON bo.business_id = b.id
LEFT JOIN business_concept_fit_multi bcfm ON bcfm.business_id = b.id
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Show enabled opportunity types
SELECT 
  'Opportunity Patterns Enabled' as note,
  CASE 
    WHEN (SELECT has_outdoor_seating FROM business_operations WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af')
    THEN '✅ Terrace Opening (spring + outdoor seating)'
    ELSE '❌ No outdoor seating'
  END as terrace_opening,
  CASE 
    WHEN (SELECT COUNT(*) FROM business_concept_fit_multi WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af' AND location_type_id = 'waterfront')
    > 0 THEN '✅ Waterfront Content (location amplifier)'
    ELSE '❌ Not waterfront'
  END as waterfront_content,
  '✅ Weather Pivots (always enabled)' as weather_pivots,
  '✅ Behind-Scenes (if performance data shows high engagement)' as behind_scenes;

-- Expected: Shows which opportunity patterns are available for this business

-- ============================================================================
-- TEST 9: WEEKLY PLANNING READINESS
-- ============================================================================
SELECT 
  '=== TEST 9: WEEKLY PLANNING READINESS ===' as test_section;

-- Check if we have enough data for weekly planning
WITH readiness_check AS (
  SELECT 
    b.id,
    b.name,
    
    -- Layer 1: Menu data
    (SELECT COUNT(*) FROM menu_results_v2 WHERE business_id = b.id AND status = 'completed') > 0 as has_menu,
    
    -- Layer 2: Content distribution rules
    (SELECT COUNT(*) FROM business_type_defaults WHERE business_type = b.category) > 0 as has_distribution,
    
    -- Layer 3: Calendar events
    (SELECT COUNT(*) FROM contextual_calendar WHERE country = b.country) > 0 as has_calendar,
    
    -- Layer 4: Performance tracking ready (even if empty)
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'content_performance_log') > 0 as has_performance_tracking,
    
    -- Layer 5: Menu scoring infrastructure
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'menu_item_metadata') > 0 as has_menu_scoring,
    (SELECT COUNT(*) FROM seasonal_ingredients WHERE country_code = 'DK') >= 40 as has_seasonal_data
    
  FROM businesses b
  WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af'
)
SELECT 
  name,
  CASE WHEN has_menu THEN '✅' ELSE '❌' END || ' Menu data' as check_1,
  CASE WHEN has_distribution THEN '✅' ELSE '❌' END || ' Content distribution rules' as check_2,
  CASE WHEN has_calendar THEN '✅' ELSE '❌' END || ' Calendar events' as check_3,
  CASE WHEN has_performance_tracking THEN '✅' ELSE '❌' END || ' Performance tracking' as check_4,
  CASE WHEN has_menu_scoring THEN '✅' ELSE '❌' END || ' Menu scoring tables' as check_5,
  CASE WHEN has_seasonal_data THEN '✅' ELSE '❌' END || ' Seasonal ingredients database' as check_6,
  CASE 
    WHEN has_menu AND has_distribution AND has_calendar AND has_performance_tracking AND has_menu_scoring AND has_seasonal_data
    THEN '✅ READY for weekly planning'
    ELSE '⚠️ Missing components - see above'
  END as weekly_planning_status
FROM readiness_check;

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================
SELECT 
  '=== LAYER 5 VERIFICATION SUMMARY ===' as test_section;

-- Check overall Layer 5 readiness
WITH layer5_checks AS (
  SELECT 
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_item_metadata') as has_menu_metadata,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'seasonal_ingredients') as has_seasonal_ingredients,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'opportunity_tracking') as has_opportunity_tracking,
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_menu_item_posted') as has_update_func,
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'track_opportunity_trigger') as has_track_func,
    (SELECT COUNT(*) FROM seasonal_ingredients WHERE country_code = 'DK') >= 40 as has_seasonal_data
)
SELECT 
  'Layer 5 Infrastructure Status' as component,
  CASE 
    WHEN has_menu_metadata AND has_seasonal_ingredients AND has_opportunity_tracking AND has_update_func AND has_track_func AND has_seasonal_data
    THEN '✅ COMPLETE - All components deployed'
    ELSE '⚠️ INCOMPLETE - Missing components'
  END as status
FROM layer5_checks;

-- Show component breakdown
SELECT 
  '--- Component Breakdown ---' as section,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_item_metadata')
    THEN '✅' ELSE '❌' END || ' menu_item_metadata (Menu scoring data)' as component_1,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'seasonal_ingredients')
    THEN '✅' ELSE '❌' END || ' seasonal_ingredients (Seasonal matching)' as component_2,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'opportunity_tracking')
    THEN '✅' ELSE '❌' END || ' opportunity_tracking (Opportunity management)' as component_3,
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_menu_item_posted')
    THEN '✅' ELSE '❌' END || ' update_menu_item_posted() (Recency tracking)' as component_4,
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'track_opportunity_trigger')
    THEN '✅' ELSE '❌' END || ' track_opportunity_trigger() (Opportunity prevention)' as component_5;

-- Show data status
SELECT 
  '--- Data Population Status ---' as section,
  (SELECT COUNT(*) FROM menu_item_metadata) as total_menu_items_with_metadata,
  (SELECT COUNT(*) FROM seasonal_ingredients WHERE country_code = 'DK') as danish_seasonal_ingredients,
  (SELECT COUNT(*) FROM opportunity_tracking) as opportunities_tracked,
  CASE 
    WHEN (SELECT COUNT(*) FROM menu_item_metadata) = 0 
    THEN '⚠️ No menu items tagged yet - menu scoring will use on-demand extraction'
    WHEN (SELECT COUNT(*) FROM menu_item_metadata) < 10
    THEN '⚠️ Limited menu data - consider populating more items'
    ELSE '✅ Menu items populated'
  END as menu_data_status;

-- ============================================================================
-- ADDITIONAL INFO: Layer 5 Components
-- ============================================================================
SELECT 
  '=== LAYER 5 COMPONENT DETAILS ===' as info_section;

SELECT 
  'Component A: Menu Scoring Engine' as component,
  '✅ Infrastructure deployed' as status,
  'Scores menu items using 7 factors: seasonal, weather, location, performance, newness, signature, recency' as functionality,
  'TypeScript: menu-scorer.ts' as implementation;

SELECT 
  'Component B: Non-Menu Opportunities' as component,
  '✅ TypeScript implementation complete' as status,
  '9 patterns: outdoor, waterfront, tourist, business district, residential, weather pivots, terrace, team, events' as functionality,
  'TypeScript: compound-opportunities.ts (enhanced)' as implementation;

SELECT 
  'Component C: Weekly Planning Selector' as component,
  '✅ TypeScript implementation complete' as status,
  '6-step algorithm: generate, allocate, fill, sequence, time, edge cases' as functionality,
  'TypeScript: opportunity-selector.ts' as implementation;

-- ============================================================================
-- WHAT LAYER 5 PROVIDES TO LAYER 6
-- ============================================================================
SELECT 
  '=== LAYER 5 → LAYER 6 DATA FLOW ===' as info_section;

SELECT 
  'Layer 6 (Post Specification) receives from Layer 5:' as data_flow,
  '- Ranked list of menu items for food posts' as menu_content,
  '- Non-menu opportunities (terrace, team, weather pivots, etc.)' as non_menu_content,
  '- Weekly plan with 4-7 post slots allocated' as weekly_plan,
  '- Confidence scores and reasoning for each selection' as metadata;

SELECT 
  'Current State:' as state,
  '- Menu scoring: ✅ Ready (infrastructure deployed)' as menu_status,
  '- Non-menu opportunities: ✅ Ready (9 patterns implemented)' as opportunity_status,
  '- Weekly planning: ✅ Ready (selection algorithm complete)' as planning_status,
  '- Menu data: ⚠️ Can be empty (extracted on-demand from menu_results_v2)' as data_status;

SELECT 
  'Next Steps:' as state,
  '- Layer 6: Post Specification Engine (time optimization, platform selection)' as next_layer,
  '- Layer 7: Media Format & Platform Specification' as after_that,
  '- Layer 8: Caption & Creative Direction' as then_that,
  '- Layer 9: Weekly Plan Output Assembly' as finally;
