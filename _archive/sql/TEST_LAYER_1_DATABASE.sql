-- ============================================================================
-- LAYER 1: INFORMATION FOUNDATION - DATABASE VERIFICATION TEST
-- ============================================================================
-- Purpose: Verify all Layer 1 tables, columns, and data exist as expected
-- Run this against your Supabase database to ensure Layer 1 is properly set up
-- ============================================================================

-- Set test context: Replace with your actual business_id
DO $$
DECLARE
  test_business_id uuid := '840347de-9ba7-4275-8aa3-4553417fc2af';
BEGIN
  RAISE NOTICE 'Testing with business_id: %', test_business_id;
END $$;

-- ============================================================================
-- TEST 1: BUSINESSES TABLE
-- ============================================================================
SELECT 
  '=== TEST 1: BUSINESSES TABLE ===' as test_section;

-- Check if table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'businesses'
    ) 
    THEN '✅ businesses table exists'
    ELSE '❌ businesses table MISSING'
  END as table_check;

-- Check required columns
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'businesses'
  AND column_name IN ('id', 'owner_id', 'name', 'vertical', 'category', 'website_url', 'selected_platforms', 'primary_language')
ORDER BY column_name;

-- Verify column types match expectations
SELECT 
  'Column Type Check' as check_section,
  CASE 
    WHEN (SELECT data_type FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'selected_platforms') = 'jsonb'
    THEN '✅ businesses.selected_platforms is jsonb'
    ELSE '❌ businesses.selected_platforms wrong type'
  END as selected_platforms_check;

-- Check actual data for test business
SELECT 
  id,
  name,
  vertical,
  category,
  website_url,
  CASE 
    WHEN selected_platforms IS NOT NULL THEN jsonb_typeof(selected_platforms)
    ELSE 'NULL'
  END as selected_platforms_type,
  selected_platforms,
  created_at
FROM businesses
WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Expected: 
-- - category should be one of: FSE, SBO, MFV, MFD, QSR
-- - selected_platforms should be JSONB array like ["instagram", "facebook"]

-- ============================================================================
-- TEST 2: BUSINESS_LOCATION_INTELLIGENCE TABLE
-- ============================================================================
SELECT 
  '=== TEST 2: BUSINESS_LOCATION_INTELLIGENCE TABLE ===' as test_section;

-- Check if table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'business_location_intelligence'
    ) 
    THEN '✅ business_location_intelligence table exists'
    ELSE '❌ business_location_intelligence table MISSING'
  END as table_check;

-- Check required columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_location_intelligence'
  AND column_name IN (
    'business_id', 'neighborhood', 'area_type', 'latitude', 'longitude',
    'category_scores', 'has_view', 'view_type', 'outdoor_space_type',
    'neighborhood_character', 'location_marketing_hooks'
  )
ORDER BY column_name;

-- Verify column types
SELECT 
  'Column Type Check' as check_section,
  CASE 
    WHEN (SELECT data_type FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'category_scores') = 'jsonb'
    THEN '✅ category_scores is jsonb'
    ELSE '❌ category_scores wrong type: ' || (SELECT data_type FROM information_schema.columns WHERE table_name = 'business_location_intelligence' AND column_name = 'category_scores')
  END as category_scores_check;

-- Check actual data for test business
SELECT 
  bli.business_id,
  bli.neighborhood,
  bli.area_type,
  bli.latitude,
  bli.longitude,
  bli.has_view,
  bli.view_type,
  bli.outdoor_space_type,
  CASE 
    WHEN bli.category_scores IS NOT NULL THEN jsonb_typeof(bli.category_scores)
    ELSE 'NULL'
  END as category_scores_type,
  jsonb_pretty(bli.category_scores) as category_scores
FROM business_location_intelligence bli
WHERE bli.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Expected:
-- - area_type should be like 'waterfront', 'city_center', 'tourist_area', etc.
-- - category_scores should be JSONB object with scores 0-100 for each location type
--   Example: {"waterfront": 85, "tourist_area": 60, "residential": 20}

-- ============================================================================
-- TEST 3: BUSINESS_OPERATIONS TABLE
-- ============================================================================
SELECT 
  '=== TEST 3: BUSINESS_OPERATIONS TABLE ===' as test_section;

-- Check if table exists
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

-- Check required columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_operations'
  AND column_name IN (
    'business_id', 'opening_hours', 'service_periods', 'seating_capacity_indoor',
    'seating_capacity_outdoor', 'price_level', 'has_outdoor_seating', 'establishment_type',
    'has_table_service', 'has_takeaway', 'has_delivery'
  )
ORDER BY column_name;

-- Verify column types
SELECT 
  'Column Type Check' as check_section,
  CASE 
    WHEN (SELECT data_type FROM information_schema.columns WHERE table_name = 'business_operations' AND column_name = 'has_outdoor_seating') = 'boolean'
    THEN '✅ has_outdoor_seating is boolean'
    ELSE '❌ has_outdoor_seating wrong type'
  END as outdoor_seating_check,
  CASE 
    WHEN (SELECT data_type FROM information_schema.columns WHERE table_name = 'business_operations' AND column_name = 'establishment_type') = 'character varying'
    THEN '✅ establishment_type is character varying'
    ELSE '❌ establishment_type wrong type'
  END as establishment_type_check;

-- Check actual data for test business
SELECT 
  bo.business_id,
  CASE 
    WHEN bo.opening_hours IS NOT NULL THEN jsonb_typeof(bo.opening_hours)
    ELSE 'NULL'
  END as opening_hours_type,
  CASE 
    WHEN bo.service_periods IS NOT NULL THEN jsonb_typeof(bo.service_periods)
    ELSE 'NULL'
  END as service_periods_type,
  bo.seating_capacity_indoor,
  bo.seating_capacity_outdoor,
  bo.price_level,
  bo.has_outdoor_seating,
  bo.establishment_type,
  bo.has_table_service,
  bo.has_takeaway,
  bo.has_delivery
FROM business_operations bo
WHERE bo.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';
-- Expected:
-- - establishment_type should be one of: FSE, SBO, MFV, MFD, QSR
-- - price_level should be: budget, moderate, upscale, fine_dining
-- - has_outdoor_seating: boolean (important for seasonal content)

-- ============================================================================
-- TEST 4: MENU_RESULTS_V2 TABLE
-- ============================================================================
SELECT 
  '=== TEST 4: MENU_RESULTS_V2 TABLE ===' as test_section;

-- Check if table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'menu_results_v2'
    ) 
    THEN '✅ menu_results_v2 table exists'
    ELSE '❌ menu_results_v2 table MISSING'
  END as table_check;

-- Check required columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'menu_results_v2'
  AND column_name IN (
    'id', 'business_id', 'source_url', 'status', 'structured_data',
    'language_code', 'extraction_method', 'completed_at'
  )
ORDER BY column_name;

-- Check actual data for test business
SELECT 
  mr.id,
  mr.business_id,
  mr.source_url,
  mr.status,
  mr.language_code,
  mr.extraction_method,
  CASE 
    WHEN mr.structured_data IS NOT NULL THEN jsonb_typeof(mr.structured_data)
    ELSE 'NULL'
  END as structured_data_type,
  LENGTH(mr.structured_data::text) as data_size_bytes,
  mr.completed_at,
  mr.created_at
FROM menu_results_v2 mr
WHERE mr.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY mr.created_at DESC
LIMIT 1;

-- Check menu structure (sample the first item)
SELECT 
  '--- Menu Data Sample ---' as section,
  jsonb_pretty(mr.structured_data -> 'menu' -> 'sections' -> 0) as first_section_sample
FROM menu_results_v2 mr
WHERE mr.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND mr.status = 'done'
  AND mr.structured_data IS NOT NULL
LIMIT 1;

-- Expected:
-- - status should be 'done'
-- - structured_data should be JSONB object with menu sections, items, categories
-- - Structure: { menu: { sections: [{ items: [{ name, description, price }] }] } }

-- ============================================================================
-- TEST 5: CROSS-TABLE RELATIONSHIPS
-- ============================================================================
SELECT 
  '=== TEST 5: CROSS-TABLE RELATIONSHIPS ===' as test_section;

-- Check that all tables are properly linked
SELECT 
  b.id as business_id,
  b.name as business_name,
  b.category as business_type,
  CASE WHEN bli.business_id IS NOT NULL THEN '✅' ELSE '❌ MISSING' END as has_location_intel,
  CASE WHEN bo.business_id IS NOT NULL THEN '✅' ELSE '❌ MISSING' END as has_operations,
  CASE WHEN mr.business_id IS NOT NULL THEN '✅' ELSE '❌ MISSING' END as has_menu,
  COUNT(DISTINCT mr.id) as menu_items_count
FROM businesses b
LEFT JOIN business_location_intelligence bli ON bli.business_id = b.id
LEFT JOIN business_operations bo ON bo.business_id = b.id
LEFT JOIN menu_results_v2 mr ON mr.business_id = b.id AND mr.status = 'done'
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af'
GROUP BY b.id, b.name, b.category, bli.business_id, bo.business_id, mr.business_id;

-- Expected: All ✅ checks should pass

-- ============================================================================
-- TEST 6: LAYER 1 DATA QUALITY CHECKS
-- ============================================================================
SELECT 
  '=== TEST 6: LAYER 1 DATA QUALITY CHECKS ===' as test_section;

-- Check 1: Business has required fields
SELECT 
  'Check 1: Business Category' as check_name,
  CASE 
    WHEN b.category IN ('FSE', 'SBO', 'MFV', 'MFD', 'QSR') THEN '✅ Valid category: ' || b.category
    WHEN b.category IS NULL THEN '⚠️ Category is NULL (will default to FSE)'
    ELSE '❌ Invalid category: ' || b.category
  END as result
FROM businesses b
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Check 2: Location intelligence has category scores
SELECT 
  'Check 2: Location Category Scores' as check_name,
  CASE 
    WHEN bli.category_scores IS NOT NULL AND jsonb_typeof(bli.category_scores) = 'object' 
    THEN '✅ Category scores exist (keys: ' || (SELECT string_agg(keys, ', ') FROM jsonb_object_keys(bli.category_scores) AS keys) || ')'
    ELSE '❌ Category scores missing or invalid'
  END as result
FROM business_location_intelligence bli
WHERE bli.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Check 3: Operations has establishment type
SELECT 
  'Check 3: Establishment Type' as check_name,
  CASE 
    WHEN bo.establishment_type IN ('FSE', 'SBO', 'MFV', 'MFD', 'QSR') 
    THEN '✅ Valid establishment type: ' || bo.establishment_type
    WHEN bo.establishment_type IS NULL 
    THEN '⚠️ Establishment type is NULL'
    ELSE '❌ Invalid establishment type: ' || bo.establishment_type
  END as result
FROM business_operations bo
WHERE bo.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Check 4: Menu has structured data
SELECT 
  'Check 4: Menu Data Structure' as check_name,
  CASE 
    WHEN mr.structured_data -> 'menu' -> 'sections' IS NOT NULL 
    THEN '✅ Menu has sections (count: ' || jsonb_array_length(mr.structured_data -> 'menu' -> 'sections') || ')'
    ELSE '❌ Menu structure invalid or missing'
  END as result
FROM menu_results_v2 mr
WHERE mr.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND mr.status = 'done'
ORDER BY mr.created_at DESC
LIMIT 1;
-- Check 5: Outdoor seating flag (important for Layer 3 seasonal content)
SELECT 
  'Check 5: Outdoor Seating Flag' as check_name,
  CASE 
    WHEN bo.has_outdoor_seating = true THEN '✅ Has outdoor seating (will boost seasonal content)'
    WHEN bo.has_outdoor_seating = false THEN '⚠️ No outdoor seating'
    ELSE '❌ Outdoor seating not set'
  END as result
FROM business_operations bo
JOIN businesses b ON b.id = bo.business_id
WHERE bo.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- ============================================================================
-- TEST 7: SIMULATE LAYER 1 DATA FETCH (as Edge Function does)
-- ============================================================================
SELECT
  '=== TEST 7: SIMULATE EDGE FUNCTION DATA FETCH ===' as test_section;

-- This simulates what generate-weekly-plan Edge Function fetches
WITH business_data AS (
  SELECT 
    b.id,
    b.name,
    b.category,
    b.selected_platforms
  FROM businesses b
  WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af'
)
SELECT 
  '--- Edge Function would receive this data ---' as section,
  jsonb_build_object(
    'business', jsonb_build_object(
      'id', bd.id,
      'name', bd.name,
      'category', COALESCE(bd.category, 'FSE'),
      'selected_platforms', COALESCE(bd.selected_platforms, '["instagram", "facebook"]'::jsonb)
    ),
    'locationIntel', jsonb_build_object(
      'area_type', bli.area_type,
      'category_scores', bli.category_scores,
      'has_view', bli.has_view,
      'outdoor_space_type', bli.outdoor_space_type
    ),
    'operations', jsonb_build_object(
      'establishment_type', bo.establishment_type,
      'has_outdoor_seating', bo.has_outdoor_seating,
      'price_level', bo.price_level,
      'seating_capacity', bo.seating_capacity_indoor + COALESCE(bo.seating_capacity_outdoor, 0)
    ),
    'menuItemsCount', (
      SELECT COUNT(*) 
      FROM menu_results_v2 mr 
      WHERE mr.business_id = bd.id AND mr.status = 'done'
    )
  ) as layer_1_data
FROM business_data bd
LEFT JOIN business_location_intelligence bli ON bli.business_id = bd.id
LEFT JOIN business_operations bo ON bo.business_id = bd.id;

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================
SELECT 
  '=== LAYER 1 VERIFICATION SUMMARY ===' as test_section;

SELECT 
  '✅ All tests passed' as status
WHERE (
  -- Business table exists with data
  EXISTS (SELECT 1 FROM businesses WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af')
  AND
  -- Location intelligence exists
  EXISTS (
    SELECT 1 FROM business_location_intelligence bli
    WHERE bli.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  )
  AND
  -- Operations exists
  EXISTS (
    SELECT 1 FROM business_operations bo
    WHERE bo.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  )
  AND
  -- Menu exists
  EXISTS (
    SELECT 1 FROM menu_results_v2 mr
    WHERE mr.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af' AND mr.status = 'done'
  )
);

-- If no result above, show what's missing
SELECT 
  CASE WHEN NOT EXISTS (SELECT 1 FROM businesses WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af')
    THEN '❌ Business record missing'
  END as missing_business,
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM business_location_intelligence bli
    WHERE bli.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  )
    THEN '❌ Location intelligence missing'
  END as missing_location,
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM business_operations bo
    WHERE bo.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  )
    THEN '❌ Operations record missing'
  END as missing_operations,
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM menu_results_v2 mr
    WHERE mr.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af' AND mr.status = 'done'
  )
    THEN '❌ Menu data missing or not processed'
  END as missing_menu
WHERE (
  NOT EXISTS (SELECT 1 FROM businesses WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af')
  OR NOT EXISTS (
    SELECT 1 FROM business_location_intelligence bli
    WHERE bli.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  )
  OR NOT EXISTS (
    SELECT 1 FROM business_operations bo
    WHERE bo.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  )
  OR NOT EXISTS (
    SELECT 1 FROM menu_results_v2 mr
    WHERE mr.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af' AND mr.status = 'done'
  )
);