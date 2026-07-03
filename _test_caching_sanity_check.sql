-- =====================================================
-- CACHING SYSTEM SANITY CHECK
-- =====================================================
-- Verifies that caching columns exist and data integrity
-- Run this after applying _apply_missing_daily_suggestions_columns.sql
-- =====================================================

-- TEST 1: Verify all caching columns exist
SELECT 
  '✅ TEST 1: Column Existence' AS test_name,
  CASE 
    WHEN COUNT(*) = 6 THEN 'PASS'
    ELSE 'FAIL - Expected 6 columns, found ' || COUNT(*)
  END AS result,
  COUNT(*) AS columns_found
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'daily_suggestions'
  AND column_name IN (
    'generated_text',
    'generated_hashtags',
    'generated_platform_content',
    'generated_at',
    'platforms_generated',
    'text_generation_version'
  );

-- TEST 2: Verify column data types
SELECT 
  '✅ TEST 2: Column Data Types' AS test_name,
  CASE 
    WHEN COUNT(*) = 6 THEN 'PASS'
    ELSE 'FAIL - Incorrect data types'
  END AS result,
  string_agg(column_name || ':' || data_type, ', ') AS type_details
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'daily_suggestions'
  AND (
    (column_name = 'generated_text' AND data_type = 'text') OR
    (column_name = 'generated_hashtags' AND data_type = 'jsonb') OR
    (column_name = 'generated_platform_content' AND data_type = 'jsonb') OR
    (column_name = 'generated_at' AND data_type = 'timestamp with time zone') OR
    (column_name = 'platforms_generated' AND data_type = 'ARRAY') OR
    (column_name = 'text_generation_version' AND data_type = 'integer')
  );

-- TEST 3: Verify index exists for performance
SELECT 
  '✅ TEST 3: Cache Index' AS test_name,
  CASE 
    WHEN COUNT(*) >= 1 THEN 'PASS'
    ELSE 'FAIL - Index not found'
  END AS result,
  string_agg(indexname, ', ') AS index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'daily_suggestions'
  AND indexname LIKE '%generation_cache%';

-- TEST 4: Check for cached suggestions (data quality)
SELECT 
  '✅ TEST 4: Cached Suggestions Count' AS test_name,
  CASE 
    WHEN COUNT(*) >= 0 THEN 'INFO'
    ELSE 'N/A'
  END AS result,
  COUNT(*) AS total_suggestions,
  COUNT(generated_text) AS cached_suggestions,
  ROUND(100.0 * COUNT(generated_text) / NULLIF(COUNT(*), 0), 1) AS cache_percentage
FROM daily_suggestions
WHERE date >= CURRENT_DATE - INTERVAL '7 days';

-- TEST 5: Verify JSONB structure integrity
SELECT 
  '✅ TEST 5: JSONB Structure' AS test_name,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS - No invalid JSONB'
    ELSE 'FAIL - Found ' || COUNT(*) || ' rows with invalid JSONB'
  END AS result,
  COUNT(*) AS invalid_rows
FROM daily_suggestions
WHERE generated_hashtags IS NOT NULL 
  AND NOT (generated_hashtags ? 'tag' OR jsonb_typeof(generated_hashtags) = 'array');

-- TEST 6: Check cache freshness (data should be from today or recent)
SELECT 
  '✅ TEST 6: Cache Freshness' AS test_name,
  CASE 
    WHEN MAX(generated_at) IS NULL THEN 'INFO - No cached data yet'
    WHEN MAX(generated_at) >= CURRENT_DATE THEN 'PASS - Recent cache'
    WHEN MAX(generated_at) >= CURRENT_DATE - INTERVAL '7 days' THEN 'WARN - Cache older than today'
    ELSE 'INFO - Old cache (expected if system not used recently)'
  END AS result,
  MAX(generated_at) AS most_recent_cache,
  MIN(generated_at) AS oldest_cache,
  COUNT(DISTINCT DATE(generated_at)) AS days_with_cached_content
FROM daily_suggestions
WHERE generated_at IS NOT NULL;

-- TEST 7: Verify version tracking
SELECT 
  '✅ TEST 7: Version Tracking' AS test_name,
  CASE 
    WHEN MAX(text_generation_version) IS NULL THEN 'INFO - No versioned content yet'
    WHEN MAX(text_generation_version) >= 8 THEN 'PASS - Current version (V5.5 Tone DNA)'
    ELSE 'WARN - Old version detected'
  END AS result,
  MIN(text_generation_version) AS min_version,
  MAX(text_generation_version) AS max_version,
  COUNT(DISTINCT text_generation_version) AS version_count
FROM daily_suggestions
WHERE text_generation_version IS NOT NULL;

-- TEST 8: Platform consistency check
SELECT 
  '✅ TEST 8: Platform Arrays' AS test_name,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS - All platform arrays valid'
    ELSE 'WARN - Found ' || COUNT(*) || ' rows with unexpected platforms'
  END AS result,
  COUNT(*) AS suspicious_rows
FROM daily_suggestions
WHERE platforms_generated IS NOT NULL
  AND NOT (
    platforms_generated <@ ARRAY['facebook', 'instagram']::TEXT[]
  );

-- SUMMARY: Overall system health
SELECT 
  '📊 CACHE SYSTEM SUMMARY' AS report,
  COUNT(*) AS total_suggestions_7d,
  COUNT(generated_text) AS cached_suggestions,
  ROUND(100.0 * COUNT(generated_text) / NULLIF(COUNT(*), 0), 1) AS cache_hit_rate,
  COUNT(DISTINCT text_generation_version) AS active_versions,
  MAX(generated_at) AS last_cache_write,
  COUNT(*) FILTER (WHERE generated_at >= CURRENT_DATE) AS cached_today
FROM daily_suggestions
WHERE date >= CURRENT_DATE - INTERVAL '7 days';
