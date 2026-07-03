-- =====================================================
-- APPLY THIS MIGRATION MANUALLY VIA SUPABASE DASHBOARD
-- =====================================================
-- 
-- Migration: Add indexes for menu rotation tracking
-- Date: 2026-06-08
-- Purpose: Fast lookups for rotation queue and pattern analysis
--
-- HOW TO APPLY:
-- 1. Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
-- 2. Copy-paste this entire file into the SQL Editor
-- 3. Click "Run" button
-- 4. Verify success in output
--
-- =====================================================

-- ── 1. Menu rotation queue index ──────────────────────────────
-- Fast lookup: "Which dishes were used recently for this business?"
CREATE INDEX IF NOT EXISTS idx_published_posts_menu_rotation
  ON published_posts(business_id, menu_item_name, posted_at DESC)
  WHERE menu_item_name IS NOT NULL 
    AND idea_source IN ('quick_suggestions', 'weekly_plan')
    AND status IN ('published', 'scheduled');

COMMENT ON INDEX idx_published_posts_menu_rotation IS 
  'Optimizes rotation queue queries: finds recently-used dishes per business (AI posts only)';

-- ── 2. Pattern history index ──────────────────────────────────
-- Fast lookup: "What content types were posted on which days?"
CREATE INDEX IF NOT EXISTS idx_published_posts_pattern_history
  ON published_posts(business_id, posted_at DESC, content_type)
  WHERE content_type IS NOT NULL
    AND idea_source IN ('quick_suggestions', 'weekly_plan')
    AND status IN ('published', 'scheduled');

COMMENT ON INDEX idx_published_posts_pattern_history IS 
  'Optimizes pattern tracking: prevents same content_type on same weekday (AI posts only)';

-- ── 3. Scheduled week lookup index ────────────────────────────
-- Fast lookup: "What dishes are already scheduled this week?"
CREATE INDEX IF NOT EXISTS idx_published_posts_scheduled_week
  ON published_posts(business_id, scheduled_for, menu_item_name)
  WHERE status = 'scheduled'
    AND menu_item_name IS NOT NULL;

COMMENT ON INDEX idx_published_posts_scheduled_week IS 
  'Optimizes "already scheduled" check: prevents suggesting dishes already queued';

-- ── 4. Service period filter index (composite) ────────────────
-- Fast lookup: "Show me brunch posts from last 90 days"
-- Uses existing columns, no new column needed
CREATE INDEX IF NOT EXISTS idx_published_posts_by_period
  ON published_posts(business_id, posted_at DESC, menu_item_name, content_type)
  WHERE idea_source IN ('quick_suggestions', 'weekly_plan')
    AND status IN ('published', 'scheduled');

COMMENT ON INDEX idx_published_posts_by_period IS 
  'Optimizes service-period-filtered queries (covers menu_item_name and content_type)';

-- ── 5. Verify indexes were created ────────────────────────────
SELECT 
  'Indexes created successfully!' AS message,
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'published_posts'
  AND indexname IN (
    'idx_published_posts_menu_rotation',
    'idx_published_posts_pattern_history',
    'idx_published_posts_scheduled_week',
    'idx_published_posts_by_period'
  )
ORDER BY indexname;

-- Expected: 4 rows returned (one per index)

-- ── 6. Test index performance ─────────────────────────────────
-- Query plan should show "Index Scan" not "Seq Scan"
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
  menu_item_name,
  MAX(posted_at) as last_used_at,
  COUNT(*) as times_used
FROM published_posts
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'  -- Your test business
  AND menu_item_name IS NOT NULL
  AND idea_source IN ('quick_suggestions', 'weekly_plan')
  AND posted_at >= NOW() - INTERVAL '90 days'
  AND status IN ('published', 'scheduled')
GROUP BY menu_item_name;

-- Expected: Execution time < 10ms with index
