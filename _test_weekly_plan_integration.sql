-- =====================================================
-- TEST: Verify Weekly Plan + Quick Suggestions Integration
-- =====================================================
-- Verifies source column and integration implementation
-- Run this after applying 20260607000001_add_source_to_daily_suggestions.sql
-- =====================================================

-- TEST 1: Verify source column exists
SELECT 
  '✅ TEST 1: Source Column Existence' AS test_name,
  CASE 
    WHEN COUNT(*) = 1 THEN 'PASS'
    ELSE 'FAIL - Source column not found'
  END AS result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'daily_suggestions'
  AND column_name = 'source';

-- TEST 2: Verify source column has correct constraint
SELECT 
  '✅ TEST 2: Source Column Check Constraint' AS test_name,
  CASE 
    WHEN COUNT(*) >= 1 THEN 'PASS'
    ELSE 'FAIL - Check constraint not found'
  END AS result,
  string_agg(conname, ', ') AS constraint_names
FROM pg_constraint
WHERE conname LIKE '%source%'
  AND conrelid = 'daily_suggestions'::regclass;

-- TEST 3: Verify new unique constraint exists
SELECT 
  '✅ TEST 3: New Unique Constraint' AS test_name,
  CASE 
    WHEN COUNT(*) = 1 THEN 'PASS'
    ELSE 'FAIL - Constraint not found'
  END AS result
FROM pg_constraint
WHERE conname = 'daily_suggestions_business_date_position_source_key'
  AND conrelid = 'daily_suggestions'::regclass;

-- TEST 4: Verify old unique constraint is dropped
SELECT 
  '✅ TEST 4: Old Constraint Removed' AS test_name,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS'
    ELSE 'FAIL - Old constraint still exists'
  END AS result
FROM pg_constraint
WHERE conname = 'daily_suggestions_business_id_suggestion_date_position_key'
  AND conrelid = 'daily_suggestions'::regclass;

-- TEST 5: Verify index exists for performance
SELECT 
  '✅ TEST 5: Source Index' AS test_name,
  CASE 
    WHEN COUNT(*) >= 1 THEN 'PASS'
    ELSE 'FAIL - Index not found'
  END AS result,
  string_agg(indexname, ', ') AS index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'daily_suggestions'
  AND indexname = 'idx_daily_suggestions_source';

-- TEST 6: Check data distribution by source
SELECT 
  '✅ TEST 6: Data Distribution by Source' AS test_name,
  source,
  COUNT(*) AS suggestion_count,
  COUNT(DISTINCT business_id) AS business_count,
  COUNT(DISTINCT date) AS date_count,
  MIN(date) AS earliest_date,
  MAX(date) AS latest_date
FROM daily_suggestions
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY source
ORDER BY source;

-- TEST 7: Verify both sources can coexist for same day
SELECT 
  '✅ TEST 7: Coexistence Check' AS test_name,
  COUNT(DISTINCT CONCAT(business_id, '-', date)) AS days_with_suggestions,
  COUNT(DISTINCT CASE WHEN source = 'quick_suggestions' THEN CONCAT(business_id, '-', date) END) AS days_with_quick_suggestions,
  COUNT(DISTINCT CASE WHEN source = 'weekly_plan' THEN CONCAT(business_id, '-', date) END) AS days_with_weekly_plan,
  COUNT(DISTINCT CONCAT(business_id, '-', date)) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM daily_suggestions ds2 
      WHERE ds2.business_id = daily_suggestions.business_id 
        AND ds2.date = daily_suggestions.date 
        AND ds2.source != daily_suggestions.source
    )
  ) AS days_with_both_sources
FROM daily_suggestions
WHERE date >= CURRENT_DATE - INTERVAL '7 days';

-- TEST 8: Check for duplicate violations (should be 0)
SELECT 
  '✅ TEST 8: Duplicate Check' AS test_name,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS - No duplicates'
    ELSE 'FAIL - Found ' || COUNT(*) || ' duplicate groups'
  END AS result,
  COUNT(*) AS duplicate_groups
FROM (
  SELECT business_id, date, position, source, COUNT(*) as cnt
  FROM daily_suggestions
  WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY business_id, date, position, source
  HAVING COUNT(*) > 1
) dups;

-- TEST 9: Verify source NOT NULL constraint
SELECT 
  '✅ TEST 9: Source NOT NULL' AS test_name,
  CASE 
    WHEN is_nullable = 'NO' THEN 'PASS'
    ELSE 'FAIL - Column allows NULL'
  END AS result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'daily_suggestions'
  AND column_name = 'source';

-- TEST 10: Check published_posts has idea_source column (for tracking)
SELECT 
  '✅ TEST 10: Published Posts Tracking' AS test_name,
  CASE 
    WHEN COUNT(*) = 1 THEN 'PASS'
    ELSE 'INFO - idea_source column not found (may not be implemented yet)'
  END AS result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'published_posts'
  AND column_name = 'idea_source';

-- SUMMARY: Integration Status
SELECT 
  '📊 INTEGRATION SUMMARY' AS report,
  COUNT(*) AS total_suggestions_30d,
  COUNT(DISTINCT source) AS sources_in_use,
  COUNT(*) FILTER (WHERE source = 'quick_suggestions') AS quick_suggestions_count,
  COUNT(*) FILTER (WHERE source = 'weekly_plan') AS weekly_plan_count,
  COUNT(DISTINCT business_id) AS businesses_with_suggestions,
  MAX(created_at) AS most_recent_suggestion,
  COUNT(DISTINCT CASE WHEN source = 'quick_suggestions' THEN business_id END) AS businesses_using_quick_suggestions,
  COUNT(DISTINCT CASE WHEN source = 'weekly_plan' THEN business_id END) AS businesses_using_weekly_plan
FROM daily_suggestions
WHERE date >= CURRENT_DATE - INTERVAL '30 days';

-- DETAIL: Sample data from each source
SELECT 
  '📝 SAMPLE DATA' AS section,
  source,
  business_id,
  date,
  position,
  title,
  content_type,
  created_at
FROM daily_suggestions
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY source, date DESC, position
LIMIT 10;
