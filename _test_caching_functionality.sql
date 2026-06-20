-- =====================================================
-- CACHING FUNCTIONALITY TEST
-- =====================================================
-- Tests real-world cache scenarios and edge cases
-- Run this to verify caching logic works correctly
-- =====================================================

-- SCENARIO 1: Cache Hit - Same platforms, current version
-- Expected: Frontend should use cached content
SELECT 
  '🎯 SCENARIO 1: Perfect Cache Hit' AS scenario,
  id,
  title,
  generated_text IS NOT NULL AS has_cached_text,
  generated_at,
  platforms_generated,
  text_generation_version,
  CASE 
    WHEN generated_text IS NOT NULL 
         AND generated_at IS NOT NULL 
         AND text_generation_version >= 8 
         AND platforms_generated IS NOT NULL 
    THEN '✅ SHOULD USE CACHE'
    ELSE '❌ WILL REGENERATE'
  END AS cache_decision
FROM daily_suggestions
WHERE date = CURRENT_DATE
  AND generated_text IS NOT NULL
ORDER BY generated_at DESC
LIMIT 5;

-- SCENARIO 2: Cache Miss - Version too old
-- Expected: Frontend should regenerate (version < 8)
SELECT 
  '🎯 SCENARIO 2: Stale Version' AS scenario,
  id,
  title,
  text_generation_version AS cached_version,
  8 AS required_version,
  CASE 
    WHEN text_generation_version < 8 THEN '✅ CORRECT - Will regenerate'
    ELSE '❌ UNEXPECTED'
  END AS behavior
FROM daily_suggestions
WHERE generated_text IS NOT NULL
  AND text_generation_version < 8
ORDER BY generated_at DESC
LIMIT 5;

-- SCENARIO 3: Cache Miss - Platform mismatch
-- Expected: If user changes from [facebook] to [facebook,instagram], regenerate
-- This test shows suggestions that might face platform changes
SELECT 
  '🎯 SCENARIO 3: Platform Change Risk' AS scenario,
  id,
  title,
  platforms_generated AS cached_platforms,
  ARRAY['facebook', 'instagram'] AS user_might_select,
  CASE 
    WHEN platforms_generated <> ARRAY['facebook', 'instagram'] 
    THEN '⚠️ Will regenerate if user selects both platforms'
    ELSE '✅ Cached for both platforms'
  END AS behavior
FROM daily_suggestions
WHERE date = CURRENT_DATE
  AND generated_text IS NOT NULL
ORDER BY generated_at DESC
LIMIT 5;

-- SCENARIO 4: Hashtag structure validation
-- Expected: All hashtags should be valid JSON with proper structure
SELECT 
  '🎯 SCENARIO 4: Hashtag Data Quality' AS scenario,
  id,
  title,
  jsonb_array_length(generated_hashtags) AS hashtag_count,
  CASE 
    WHEN jsonb_typeof(generated_hashtags) = 'array' 
         AND jsonb_array_length(generated_hashtags) > 0
    THEN '✅ Valid hashtag array'
    WHEN generated_hashtags IS NULL 
    THEN '⚠️ No hashtags cached'
    ELSE '❌ Invalid structure'
  END AS data_quality,
  -- Show first hashtag as example
  generated_hashtags->0 AS example_hashtag
FROM daily_suggestions
WHERE generated_hashtags IS NOT NULL
ORDER BY generated_at DESC
LIMIT 5;

-- SCENARIO 5: Platform-specific content verification
-- Expected: Should have facebook and/or instagram objects
SELECT 
  '🎯 SCENARIO 5: Platform Content Structure' AS scenario,
  id,
  title,
  generated_platform_content ? 'facebook' AS has_facebook,
  generated_platform_content ? 'instagram' AS has_instagram,
  CASE 
    WHEN generated_platform_content ? 'facebook' 
         OR generated_platform_content ? 'instagram' 
    THEN '✅ Has platform content'
    WHEN generated_platform_content IS NULL 
    THEN '⚠️ No platform-specific content'
    ELSE '❌ Invalid structure'
  END AS validation,
  LENGTH(generated_platform_content->>'facebook') AS facebook_text_length,
  LENGTH(generated_platform_content->>'instagram') AS instagram_text_length
FROM daily_suggestions
WHERE generated_platform_content IS NOT NULL
ORDER BY generated_at DESC
LIMIT 5;

-- SCENARIO 6: Cache age distribution
-- Expected: Most caches should be from today (daily suggestions expire)
SELECT 
  '🎯 SCENARIO 6: Cache Age Analysis' AS scenario,
  DATE(generated_at) AS cache_date,
  COUNT(*) AS suggestions_cached,
  MIN(generated_at::TIME) AS earliest_cache,
  MAX(generated_at::TIME) AS latest_cache,
  CASE 
    WHEN DATE(generated_at) = CURRENT_DATE 
    THEN '✅ Today - Active'
    WHEN DATE(generated_at) >= CURRENT_DATE - INTERVAL '1 day' 
    THEN '⚠️ Yesterday - Expired but valid'
    ELSE '❌ Old - Should be regenerated'
  END AS status
FROM daily_suggestions
WHERE generated_at IS NOT NULL
GROUP BY DATE(generated_at)
ORDER BY cache_date DESC
LIMIT 7;

-- SCENARIO 7: Text generation completeness
-- Expected: If generated_text exists, all related fields should exist
SELECT 
  '🎯 SCENARIO 7: Cache Completeness' AS scenario,
  COUNT(*) AS cached_suggestions,
  COUNT(*) FILTER (WHERE generated_text IS NOT NULL) AS has_text,
  COUNT(*) FILTER (WHERE generated_hashtags IS NOT NULL) AS has_hashtags,
  COUNT(*) FILTER (WHERE generated_platform_content IS NOT NULL) AS has_platform_content,
  COUNT(*) FILTER (WHERE generated_at IS NOT NULL) AS has_timestamp,
  COUNT(*) FILTER (WHERE platforms_generated IS NOT NULL) AS has_platforms,
  COUNT(*) FILTER (WHERE text_generation_version IS NOT NULL) AS has_version,
  CASE 
    WHEN COUNT(*) FILTER (WHERE 
      generated_text IS NOT NULL AND
      generated_hashtags IS NOT NULL AND
      generated_platform_content IS NOT NULL AND
      generated_at IS NOT NULL AND
      platforms_generated IS NOT NULL AND
      text_generation_version IS NOT NULL
    ) = COUNT(*) FILTER (WHERE generated_text IS NOT NULL)
    THEN '✅ All cache entries complete'
    ELSE '⚠️ Some incomplete cache entries found'
  END AS validation
FROM daily_suggestions
WHERE date >= CURRENT_DATE - INTERVAL '7 days';

-- SCENARIO 8: Performance check - Cache lookup speed
-- Expected: Index should make this query fast (< 10ms)
EXPLAIN ANALYZE
SELECT 
  generated_text,
  generated_hashtags,
  generated_platform_content,
  generated_at,
  platforms_generated,
  text_generation_version
FROM daily_suggestions
WHERE text_generation_version >= 8
  AND generated_at IS NOT NULL
  AND date = CURRENT_DATE
LIMIT 10;

-- EDGE CASE 1: Empty arrays (should be valid but empty)
SELECT 
  '🔬 EDGE CASE 1: Empty Values' AS test,
  COUNT(*) FILTER (WHERE generated_text = '') AS empty_text,
  COUNT(*) FILTER (WHERE jsonb_array_length(generated_hashtags) = 0) AS empty_hashtags,
  COUNT(*) FILTER (WHERE array_length(platforms_generated, 1) = 0) AS empty_platforms,
  CASE 
    WHEN COUNT(*) FILTER (WHERE generated_text = '' OR 
                                  jsonb_array_length(generated_hashtags) = 0 OR 
                                  array_length(platforms_generated, 1) = 0) = 0
    THEN '✅ No empty cache entries'
    ELSE '⚠️ Found empty values - might indicate generation failure'
  END AS assessment
FROM daily_suggestions
WHERE generated_at IS NOT NULL
  AND date >= CURRENT_DATE - INTERVAL '7 days';

-- EDGE CASE 2: Very long text (potential performance issue)
SELECT 
  '🔬 EDGE CASE 2: Text Length Distribution' AS test,
  MIN(LENGTH(generated_text)) AS min_length,
  AVG(LENGTH(generated_text))::INTEGER AS avg_length,
  MAX(LENGTH(generated_text)) AS max_length,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY LENGTH(generated_text))::INTEGER AS p95_length,
  CASE 
    WHEN MAX(LENGTH(generated_text)) > 10000 
    THEN '⚠️ Very long text detected (>10k chars)'
    WHEN MAX(LENGTH(generated_text)) > 5000 
    THEN '⚠️ Long text detected (>5k chars)'
    ELSE '✅ Normal text lengths'
  END AS assessment
FROM daily_suggestions
WHERE generated_text IS NOT NULL
  AND date >= CURRENT_DATE - INTERVAL '7 days';

-- FINAL REPORT: Cache system health
SELECT 
  '📊 CACHE FUNCTIONALITY REPORT' AS report,
  '---' AS separator,
  CONCAT(
    'Total cached: ', COUNT(*) FILTER (WHERE generated_text IS NOT NULL), ' | ',
    'Today: ', COUNT(*) FILTER (WHERE generated_at >= CURRENT_DATE), ' | ',
    'Current version (≥8): ', COUNT(*) FILTER (WHERE text_generation_version >= 8), ' | ',
    'Complete entries: ', COUNT(*) FILTER (WHERE 
      generated_text IS NOT NULL AND
      generated_hashtags IS NOT NULL AND
      generated_platform_content IS NOT NULL AND
      generated_at IS NOT NULL AND
      platforms_generated IS NOT NULL AND
      text_generation_version IS NOT NULL
    )
  ) AS summary,
  CASE 
    WHEN COUNT(*) FILTER (WHERE generated_at >= CURRENT_DATE) > 0 
    THEN '✅ Caching system is active and working'
    WHEN COUNT(*) FILTER (WHERE generated_at >= CURRENT_DATE - INTERVAL '1 day') > 0 
    THEN '⚠️ No cache activity today (check if suggestions were generated)'
    ELSE '❌ No recent cache activity - system may not be caching'
  END AS health_status
FROM daily_suggestions
WHERE date >= CURRENT_DATE - INTERVAL '7 days';
