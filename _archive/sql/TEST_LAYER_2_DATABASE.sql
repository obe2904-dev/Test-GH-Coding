-- ============================================================================
-- LAYER 2: STRATEGIC BASELINES - DATABASE VERIFICATION TEST
-- ============================================================================
-- Purpose: Verify Layer 2 business type defaults and strategic configuration
-- Run this against your Supabase database to ensure Layer 2 is properly set up
-- ============================================================================

-- Set test context
DO $$
DECLARE
  test_business_id uuid := '840347de-9ba7-4275-8aa3-4553417fc2af';
BEGIN
  RAISE NOTICE 'Testing Layer 2 with business_id: %', test_business_id;
END $$;

-- ============================================================================
-- TEST 1: BUSINESS TYPE DEFAULTS TABLE (Primary Layer 2 Data)
-- ============================================================================
SELECT 
  '=== TEST 1: BUSINESS_TYPE_DEFAULTS TABLE ===' as test_section;

-- Check if table exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'business_type_defaults'
    ) 
    THEN '✅ business_type_defaults table exists'
    ELSE '❌ business_type_defaults table MISSING'
  END as table_check;

-- Check required columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_type_defaults'
ORDER BY column_name;

-- Check what business types are defined
SELECT 
  business_type,
  min_posts_per_week,
  max_posts_per_week,
  ideal_posts_per_week,
  menu_highlight_ratio,
  location_story_ratio,
  behind_scenes_ratio,
  event_promotion_ratio,
  engagement_ratio,
  default_tone,
  emoji_frequency,
  caption_length
FROM business_type_defaults
ORDER BY business_type;

-- Check defaults for test business's type
SELECT 
  '--- Defaults for Your Business Type ---' as section;

SELECT 
  btd.business_type,
  btd.ideal_posts_per_week,
  btd.instagram_weight,
  btd.facebook_weight,
  btd.menu_highlight_ratio,
  btd.location_story_ratio,
  btd.behind_scenes_ratio,
  btd.event_promotion_ratio,
  btd.engagement_ratio,
  btd.default_tone,
  btd.emoji_frequency,
  btd.caption_length
FROM business_type_defaults btd
WHERE btd.business_type = (
  SELECT category FROM businesses WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af'
);

-- Expected:
-- - business_type: FSE, SBO, MFV, MFD, QSR
-- - Ratios should total approximately 1.0 (100%)
-- - default_tone: refined, casual, playful, etc.

-- ============================================================================
-- TEST 2: BUSINESS CATEGORY VERIFICATION
-- ============================================================================
SELECT 
  '=== TEST 2: BUSINESS CATEGORY VERIFICATION ===' as test_section;

-- Check test business category
SELECT 
  b.id,
  b.name,
  b.category as business_type,
  CASE 
    WHEN b.category IN ('FSE', 'SBO', 'MFV', 'MFD', 'QSR') 
    THEN '✅ Valid category'
    WHEN b.category IS NULL 
    THEN '⚠️ Category is NULL (will default to FSE)'
    ELSE '❌ Invalid category: ' || b.category
  END as category_status
FROM businesses b
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- ============================================================================
-- TEST 3: TYPE DEFAULTS COVERAGE
-- ============================================================================
SELECT 
  '=== TEST 3: TYPE DEFAULTS COVERAGE ===' as test_section;

-- Check all business types have defaults
SELECT 
  'Check: All Business Types Have Defaults' as check_name,
  CASE 
    WHEN COUNT(DISTINCT business_type) >= 5 THEN '✅ All 5 types have defaults'
    ELSE '⚠️ Only ' || COUNT(DISTINCT business_type) || ' types have defaults'
  END as result
FROM business_type_defaults
WHERE business_type IN ('FSE', 'SBO', 'MFV', 'MFD', 'QSR');

-- List what's defined for each type
SELECT 
  business_type,
  CASE WHEN ideal_posts_per_week IS NOT NULL THEN '✅' ELSE '❌' END as has_post_frequency,
  CASE WHEN menu_highlight_ratio IS NOT NULL THEN '✅' ELSE '❌' END as has_content_ratios,
  CASE WHEN default_tone IS NOT NULL THEN '✅' ELSE '❌' END as has_tone
FROM business_type_defaults
WHERE business_type IN ('FSE', 'SBO', 'MFV', 'MFD', 'QSR')
ORDER BY business_type;

-- ============================================================================
-- TEST 4: CONTENT RATIO VALIDATION
-- ============================================================================
SELECT 
  '=== TEST 4: CONTENT RATIO VALIDATION ===' as test_section;

-- Verify ratios sum to approximately 1.0 (100%)
SELECT 
  business_type,
  (menu_highlight_ratio::numeric + 
   location_story_ratio::numeric + 
   behind_scenes_ratio::numeric + 
   event_promotion_ratio::numeric + 
   engagement_ratio::numeric) as total_ratio,
  CASE 
    WHEN ABS((menu_highlight_ratio::numeric + location_story_ratio::numeric + 
              behind_scenes_ratio::numeric + event_promotion_ratio::numeric + 
              engagement_ratio::numeric) - 1.0) < 0.01
    THEN '✅ Ratios sum correctly'
    ELSE '⚠️ Ratios do not sum to 1.0'
  END as validation_status
FROM business_type_defaults
ORDER BY business_type;

-- ============================================================================
-- TEST 5: SIMULATE LAYER 2 DATA FETCH (as Edge Function does)
-- ============================================================================
SELECT
  '=== TEST 5: SIMULATE LAYER 2 DATA FETCH ===' as test_section;

-- This simulates what the weekly plan generator fetches for Layer 2
WITH business_info AS (
  SELECT 
    b.id,
    b.name,
    b.category
  FROM businesses b
  WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af'
)
SELECT 
  '--- Layer 2 Strategic Baselines Data ---' as section,
  jsonb_build_object(
    'business_type', bi.category,
    'typeDefaults', jsonb_build_object(
      'business_type', btd.business_type,
      'ideal_posts_per_week', btd.ideal_posts_per_week,
      'min_posts_per_week', btd.min_posts_per_week,
      'max_posts_per_week', btd.max_posts_per_week,
      'content_ratios', jsonb_build_object(
        'menu_highlight', btd.menu_highlight_ratio,
        'location_story', btd.location_story_ratio,
        'behind_scenes', btd.behind_scenes_ratio,
        'event_promotion', btd.event_promotion_ratio,
        'engagement', btd.engagement_ratio
      ),
      'platform_weights', jsonb_build_object(
        'instagram', btd.instagram_weight,
        'facebook', btd.facebook_weight
      ),
      'default_tone', btd.default_tone,
      'emoji_frequency', btd.emoji_frequency,
      'caption_length', btd.caption_length
    ),
    'hasTypeDefaults', CASE WHEN btd.business_type IS NOT NULL THEN true ELSE false END
  ) as layer_2_data
FROM business_info bi
LEFT JOIN business_type_defaults btd ON btd.business_type = bi.category;

-- ============================================================================
-- TEST 6: CROSS-LAYER INTEGRATION (Layer 1 + Layer 2)
-- ============================================================================
SELECT 
  '=== TEST 6: CROSS-LAYER INTEGRATION ===' as test_section;

-- Verify Layer 1 business links to Layer 2 type defaults
SELECT 
  b.id as business_id,
  b.name,
  b.category as business_type,
  CASE WHEN btd.business_type IS NOT NULL THEN '✅ Has defaults' ELSE '❌ NO DEFAULTS' END as has_type_defaults,
  btd.ideal_posts_per_week as recommended_posts_per_week,
  btd.default_tone,
  btd.emoji_frequency
FROM businesses b
LEFT JOIN business_type_defaults btd ON btd.business_type = b.category
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================
SELECT 
  '=== LAYER 2 VERIFICATION SUMMARY ===' as test_section;

SELECT 
  '✅ All Layer 2 tests passed' as status
WHERE (
  -- Type defaults exist for business category
  EXISTS (
    SELECT 1 FROM business_type_defaults btd
    WHERE btd.business_type = (
      SELECT category FROM businesses WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af'
    )
  )
);

-- If no result above, show what's missing
SELECT 
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM business_type_defaults btd
    WHERE btd.business_type = (
      SELECT category FROM businesses WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af'
    )
  )
    THEN '❌ Type defaults missing for this business category'
  END as missing_type_defaults
WHERE (
  NOT EXISTS (
    SELECT 1 FROM business_type_defaults btd
    WHERE btd.business_type = (
      SELECT category FROM businesses WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af'
    )
  )
);

-- ============================================================================
-- ADDITIONAL INFO: What Layer 2 provides to downstream layers
-- ============================================================================
SELECT 
  '=== LAYER 2 OUTPUT FOR DOWNSTREAM LAYERS ===' as info_section;

SELECT 
  'Layer 2 provides type-specific baselines that inform:' as info,
  '- Layer 5: Content type distribution from ratios (menu, location, behind_scenes, events, engagement)' as layer_5_impact,
  '- Layer 6: Post frequency targets (min/ideal/max posts per week)' as layer_6_impact,
  '- Layer 7: Platform weight distribution (Instagram vs Facebook)' as layer_7_impact,
  '- Layer 8: Caption style (default_tone, emoji_frequency, caption_length)' as layer_8_impact;
