-- =====================================================
-- FINAL AUDIT: Verify all migrations successful
-- =====================================================

-- Check 1: Verify published_posts metadata enforcement
SELECT 
  '1️⃣ published_posts metadata' AS audit_step,
  COUNT(*) AS total_posts,
  COUNT(*) FILTER (WHERE idea_source IN ('quick_suggestions', 'weekly_plan')) AS ai_posts,
  COUNT(*) FILTER (WHERE idea_source IN ('quick_suggestions', 'weekly_plan') AND content_type IS NULL) AS ai_missing_type,
  COUNT(*) FILTER (WHERE idea_source IN ('quick_suggestions', 'weekly_plan') AND content_type = 'product' AND menu_item_name IS NULL) AS product_missing_menu
FROM published_posts;

-- Expected: ai_missing_type = 0, product_missing_menu = 0

-- Check 2: Verify rotation indexes exist
SELECT 
  '2️⃣ published_posts indexes' AS audit_step,
  COUNT(*) FILTER (WHERE indexname = 'idx_published_posts_menu_rotation') AS menu_rotation_idx,
  COUNT(*) FILTER (WHERE indexname = 'idx_published_posts_pattern_history') AS pattern_history_idx,
  COUNT(*) FILTER (WHERE indexname = 'idx_published_posts_scheduled_week') AS scheduled_week_idx,
  COUNT(*) FILTER (WHERE indexname = 'idx_published_posts_by_period') AS by_period_idx
FROM pg_indexes
WHERE tablename = 'published_posts';

-- Expected: All = 1

-- Check 3: Verify daily_suggestions metadata columns
SELECT 
  '3️⃣ daily_suggestions metadata' AS audit_step,
  COUNT(*) AS total_suggestions,
  COUNT(*) FILTER (WHERE content_type IS NOT NULL) AS suggestions_with_type,
  COUNT(*) FILTER (WHERE content_type = 'product') AS product_suggestions,
  COUNT(*) FILTER (WHERE menu_item_name IS NOT NULL) AS suggestions_with_menu
FROM daily_suggestions;

-- Expected: suggestions_with_type = total_suggestions (all have type now)

-- Check 4: Verify daily_suggestions indexes
SELECT 
  '4️⃣ daily_suggestions indexes' AS audit_step,
  COUNT(*) FILTER (WHERE indexname = 'idx_daily_suggestions_menu_item') AS menu_item_idx,
  COUNT(*) FILTER (WHERE indexname = 'idx_daily_suggestions_service_period') AS service_period_idx
FROM pg_indexes
WHERE tablename = 'daily_suggestions';

-- Expected: Both = 1

-- Check 5: Verify constraints
SELECT 
  '5️⃣ All constraints' AS audit_step,
  COUNT(*) FILTER (WHERE table_name = 'published_posts' AND constraint_name LIKE 'published_posts_%') AS published_constraints,
  COUNT(*) FILTER (WHERE table_name = 'daily_suggestions' AND constraint_name LIKE 'daily_sugg_%') AS suggestion_constraints
FROM information_schema.table_constraints
WHERE table_schema = 'public';

-- Expected: published_constraints = 3, suggestion_constraints = 3

-- =====================================================
-- ✅ If all checks pass, migrations are complete!
-- Ready to proceed to Phase 1: TypeScript Implementation
-- =====================================================
