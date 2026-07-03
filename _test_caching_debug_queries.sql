-- =====================================================
-- CACHING QUALITY IMPROVEMENTS - HELPER QUERIES
-- =====================================================
-- Run these to manually test and debug caching issues
-- =====================================================

-- QUERY 1: Find specific suggestion's cache status
-- Replace 'YOUR_SUGGESTION_ID' with actual UUID
SELECT 
  '🔍 Cache Status for Specific Suggestion' AS query,
  id,
  business_id,
  date,
  title,
  idea_type AS content_type,
  -- Cache fields
  generated_text IS NOT NULL AS has_cached_text,
  LENGTH(generated_text) AS text_length,
  jsonb_array_length(generated_hashtags) AS hashtag_count,
  platforms_generated AS cached_platforms,
  text_generation_version AS version,
  generated_at AS cached_at,
  AGE(CURRENT_TIMESTAMP, generated_at) AS cache_age,
  -- Decision logic
  CASE 
    WHEN generated_text IS NULL THEN 'CACHE MISS - No text'
    WHEN generated_at IS NULL THEN 'CACHE MISS - No timestamp'
    WHEN text_generation_version < 8 THEN 'CACHE MISS - Old version (' || text_generation_version || ' < 8)'
    WHEN platforms_generated IS NULL THEN 'CACHE MISS - No platforms'
    ELSE 'CACHE HIT - Valid (check platforms)'
  END AS cache_decision
FROM daily_suggestions
-- WHERE id = 'YOUR_SUGGESTION_ID'::UUID  -- Uncomment and replace with actual ID
ORDER BY generated_at DESC NULLS LAST
LIMIT 10;

-- QUERY 2: Invalidate old caches (set version to 0 to force regeneration)
-- Run this to manually trigger cache invalidation for testing
-- DANGEROUS: Only run for testing, will force regeneration
/*
UPDATE daily_suggestions
SET text_generation_version = 0
WHERE text_generation_version < 8
  AND generated_at IS NOT NULL;
*/

-- QUERY 3: Clear all cache for today (for testing)
-- DANGEROUS: Only use for testing/debugging
/*
UPDATE daily_suggestions
SET 
  generated_text = NULL,
  generated_hashtags = NULL,
  generated_platform_content = NULL,
  generated_at = NULL,
  platforms_generated = NULL,
  text_generation_version = NULL
WHERE date = CURRENT_DATE;
*/

-- QUERY 4: View cache hit rate by business
SELECT 
  '📊 Cache Hit Rate by Business' AS query,
  business_id,
  COUNT(*) AS total_suggestions,
  COUNT(generated_text) AS cached_count,
  ROUND(100.0 * COUNT(generated_text) / COUNT(*), 1) AS cache_rate,
  MAX(generated_at) AS last_cache_write
FROM daily_suggestions
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY business_id
ORDER BY cached_count DESC;

-- QUERY 5: Find cache entries with mismatched data
-- These might indicate bugs in cache write logic
SELECT 
  '⚠️ Cache Integrity Issues' AS query,
  id,
  title,
  CASE 
    WHEN generated_text IS NOT NULL AND generated_at IS NULL 
    THEN 'Missing timestamp'
    WHEN generated_text IS NOT NULL AND platforms_generated IS NULL 
    THEN 'Missing platforms'
    WHEN generated_text IS NOT NULL AND text_generation_version IS NULL 
    THEN 'Missing version'
    WHEN generated_hashtags IS NOT NULL AND jsonb_typeof(generated_hashtags) != 'array' 
    THEN 'Invalid hashtag structure'
    WHEN generated_platform_content IS NOT NULL 
         AND NOT (generated_platform_content ? 'facebook' OR generated_platform_content ? 'instagram')
    THEN 'Missing platform content'
    ELSE 'Unknown issue'
  END AS issue,
  generated_at
FROM daily_suggestions
WHERE generated_text IS NOT NULL
  AND (
    generated_at IS NULL OR
    platforms_generated IS NULL OR
    text_generation_version IS NULL OR
    (generated_hashtags IS NOT NULL AND jsonb_typeof(generated_hashtags) != 'array') OR
    (generated_platform_content IS NOT NULL 
     AND NOT (generated_platform_content ? 'facebook' OR generated_platform_content ? 'instagram'))
  )
ORDER BY generated_at DESC NULLS LAST
LIMIT 20;

-- QUERY 6: Monitor cache writes in real-time
-- Run this in a separate session while testing the app
-- It will show new cache entries as they're created
SELECT 
  '🔴 LIVE: Recent Cache Writes (Last 5 minutes)' AS query,
  id,
  title,
  platforms_generated,
  text_generation_version,
  generated_at,
  LENGTH(generated_text) AS text_length,
  jsonb_array_length(generated_hashtags) AS hashtag_count
FROM daily_suggestions
WHERE generated_at >= NOW() - INTERVAL '5 minutes'
ORDER BY generated_at DESC;

-- QUERY 7: Compare cache performance across content types
SELECT 
  '📈 Cache Performance by Content Type' AS query,
  idea_type AS content_type,
  COUNT(*) AS total,
  COUNT(generated_text) AS cached,
  ROUND(100.0 * COUNT(generated_text) / COUNT(*), 1) AS cache_rate,
  AVG(LENGTH(generated_text))::INTEGER AS avg_text_length,
  AVG(jsonb_array_length(generated_hashtags))::INTEGER AS avg_hashtag_count
FROM daily_suggestions
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY idea_type
ORDER BY cache_rate DESC;

-- QUERY 8: Find suggestions ready for cache test
-- These have no cache and can be used to test cache write
SELECT 
  '🧪 Suggestions Ready for Cache Test' AS query,
  id,
  business_id,
  title,
  idea_type,
  date,
  CASE 
    WHEN generated_text IS NULL THEN '✅ No cache - perfect for testing'
    WHEN generated_at < CURRENT_DATE THEN '⚠️ Has old cache - will regenerate'
    ELSE '❌ Has fresh cache - skip'
  END AS test_suitability
FROM daily_suggestions
WHERE date = CURRENT_DATE
  AND (generated_text IS NULL OR generated_at < CURRENT_DATE)
ORDER BY created_at DESC
LIMIT 10;

-- QUERY 9: Verify cache after frontend generation
-- Run this after clicking "Næste" in AI Ideas to verify cache was written
-- Replace business_id with actual value
SELECT 
  '✅ Verify Last Cache Write' AS query,
  id,
  title,
  generated_at,
  text_generation_version,
  platforms_generated,
  LENGTH(generated_text) AS text_length,
  jsonb_array_length(generated_hashtags) AS hashtag_count,
  generated_platform_content ? 'facebook' AS has_facebook_content,
  generated_platform_content ? 'instagram' AS has_instagram_content,
  EXTRACT(EPOCH FROM (NOW() - generated_at)) AS seconds_ago
FROM daily_suggestions
-- WHERE business_id = 'YOUR_BUSINESS_ID'::UUID  -- Uncomment and replace
WHERE generated_at >= NOW() - INTERVAL '1 minute'
ORDER BY generated_at DESC
LIMIT 5;

-- QUERY 10: Cache collision detection
-- Find suggestions with multiple cache writes (shouldn't happen)
SELECT 
  '🔬 Cache Write Frequency' AS query,
  id,
  title,
  generated_at,
  text_generation_version,
  COUNT(*) OVER (PARTITION BY id) AS cache_write_count,
  CASE 
    WHEN COUNT(*) OVER (PARTITION BY id) > 1 
    THEN '⚠️ Multiple cache writes detected'
    ELSE '✅ Single cache write'
  END AS status
FROM daily_suggestions
WHERE generated_at >= CURRENT_DATE - INTERVAL '7 days'
  AND generated_text IS NOT NULL
ORDER BY cache_write_count DESC, generated_at DESC
LIMIT 20;
