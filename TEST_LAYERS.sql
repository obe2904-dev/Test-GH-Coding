-- Layer-by-layer testing for user: 04b868f4-7a8d-402c-a60a-d089bf9013e1
-- Simplified version to avoid column errors

-- ============================================================================
-- LAYER 1: USER AUTHENTICATION
-- ============================================================================
SELECT '=== LAYER 1: USER AUTH ===' as section;

SELECT 
  id,
  email,
  created_at
FROM auth.users
WHERE id = '04b868f4-7a8d-402c-a60a-d089bf9013e1';

-- ============================================================================
-- LAYER 2: BUSINESS OWNERSHIP
-- ============================================================================
SELECT '=== LAYER 2: BUSINESS ===' as section;

SELECT 
  id,
  name,
  owner_id,
  vertical,
  category
FROM businesses
WHERE owner_id = '04b868f4-7a8d-402c-a60a-d089bf9013e1';

-- ============================================================================
-- LAYER 3: BUSINESS PROFILE (all columns)
-- ============================================================================
SELECT '=== LAYER 3: BUSINESS PROFILE ===' as section;

SELECT *
FROM business_profile bp
WHERE bp.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- ============================================================================
-- LAYER 4: BRAND PROFILE (all columns)
-- ============================================================================
SELECT '=== LAYER 4: BRAND PROFILE ===' as section;

SELECT *
FROM business_brand_profile bbp
WHERE bbp.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- ============================================================================
-- LAYER 5: LOCATION INTELLIGENCE (all columns)
-- ============================================================================
SELECT '=== LAYER 5: LOCATION INTELLIGENCE ===' as section;

SELECT *
FROM business_location_intelligence bli
WHERE bli.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- ============================================================================
-- LAYER 6: CONNECTED PLATFORMS
-- ============================================================================
SELECT '=== LAYER 6: PLATFORMS ===' as section;

-- Skip platforms check for now (table name unknown)
SELECT '(Skipping platforms - table name needs verification)' as note;

-- ============================================================================
-- LAYER 7: MENU DATA (CRITICAL!)
-- ============================================================================
SELECT '=== LAYER 7: MENU COUNT ===' as section;

SELECT 
  COUNT(*) as menu_items_total
FROM menu_results_v2
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

SELECT '=== LAYER 7: MENU SAMPLE ===' as section;

SELECT 
  id,
  created_at,
  updated_at
FROM menu_results_v2
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY created_at DESC
LIMIT 3;

-- ============================================================================
-- LAYER 8: WEEKLY PLANS
-- ============================================================================
SELECT '=== LAYER 8: WEEKLY PLANS ===' as section;

SELECT 
  id,
  week_number,
  week_start,
  week_end,
  jsonb_array_length(posts) as posts_count,
  generated_at
FROM weekly_content_plans
WHERE user_id = '04b868f4-7a8d-402c-a60a-d089bf9013e1'
ORDER BY week_start DESC
LIMIT 5;

-- ============================================================================
-- CRITICAL DIAGNOSTIC: Why 0 posts?
-- ============================================================================
SELECT '=== DIAGNOSTIC: GENERATION READINESS ===' as section;

SELECT 
  b.id as business_id,
  b.name,
  CASE WHEN bp.business_id IS NOT NULL THEN '✅ YES' ELSE '❌ NO' END as has_business_profile,
  CASE WHEN bbp.business_id IS NOT NULL THEN '✅ YES' ELSE '❌ NO' END as has_brand_profile,
  CASE WHEN bli.business_id IS NOT NULL THEN '✅ YES' ELSE '❌ NO' END as has_location_intel,
  COALESCE((
    SELECT COUNT(*) 
    FROM menu_results_v2 mr 
    WHERE mr.business_id = b.id
  ), 0) as menu_items_count,
  CASE 
    WHEN bp.business_id IS NULL THEN '❌ Missing business_profile'
    WHEN bbp.business_id IS NULL THEN '❌ Missing brand_profile'
    WHEN (SELECT COUNT(*) FROM menu_results_v2 mr WHERE mr.business_id = b.id) = 0 THEN '❌ Missing menu data (CRITICAL!)'
    ELSE '✅ READY TO GENERATE'
  END as status
FROM businesses b
LEFT JOIN business_profile bp ON bp.business_id = b.id
LEFT JOIN business_brand_profile bbp ON bbp.business_id = b.id
LEFT JOIN business_location_intelligence bli ON bli.business_id = b.id
WHERE b.owner_id = '04b868f4-7a8d-402c-a60a-d089bf9013e1';
