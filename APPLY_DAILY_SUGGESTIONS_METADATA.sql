-- =====================================================
-- APPLY THIS MIGRATION MANUALLY VIA SUPABASE DASHBOARD
-- =====================================================
-- 
-- Migration: Add metadata columns to daily_suggestions
-- Date: 2026-06-08
-- Purpose: Store menu_item and content_type in suggestions so they
--          flow through to published_posts when user accepts
--
-- HOW TO APPLY:
-- 1. Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
-- 2. Copy-paste this entire file into the SQL Editor
-- 3. Click "Run" button
-- 4. Verify success in output
--
-- =====================================================

-- ── 1. Add menu_item_id column ────────────────────────────────
ALTER TABLE daily_suggestions
ADD COLUMN IF NOT EXISTS menu_item_id UUID;

COMMENT ON COLUMN daily_suggestions.menu_item_id IS 
  'FK to menu_items_normalized.id - links suggestion to specific menu item';

-- ── 2. Add menu_item_name column ──────────────────────────────
ALTER TABLE daily_suggestions
ADD COLUMN IF NOT EXISTS menu_item_name TEXT;

COMMENT ON COLUMN daily_suggestions.menu_item_name IS 
  'Denormalized dish name for rotation tracking (avoids JOIN in hot path)';

-- ── 3. Add content_type column ────────────────────────────────
ALTER TABLE daily_suggestions
ADD COLUMN IF NOT EXISTS content_type TEXT;

COMMENT ON COLUMN daily_suggestions.content_type IS 
  'Type of content: product, experience, atmosphere, retention, occasion, team';

-- ── 4. Add service_period column ──────────────────────────────
ALTER TABLE daily_suggestions
ADD COLUMN IF NOT EXISTS service_period TEXT;

COMMENT ON COLUMN daily_suggestions.service_period IS 
  'Which service period this suggestion is for: brunch, lunch, dinner, all_day';

-- ── 5. Add content_angle column ───────────────────────────────
ALTER TABLE daily_suggestions
ADD COLUMN IF NOT EXISTS content_angle TEXT;

COMMENT ON COLUMN daily_suggestions.content_angle IS 
  'Strategic angle for this post, e.g. "Rainy-day comfort classic"';

-- ── 6. Backfill existing rows with default values ────────────
-- Convert old content_type values to new schema
UPDATE daily_suggestions 
SET content_type = 'product'
WHERE content_type IS NULL OR content_type = 'menu_item';

-- Note: Old suggestions used 'menu_item' type, now we use 'product'
-- Existing suggestions won't have menu_item_name, but that's OK
-- They're old data and won't be used for rotation tracking
-- New suggestions (after code update) will have proper metadata

-- ── 7. Add constraints (same as published_posts) ──────────────
ALTER TABLE daily_suggestions
DROP CONSTRAINT IF EXISTS daily_sugg_content_type_required;

-- ── 7. Add constraints (same as published_posts) ──────────────
ALTER TABLE daily_suggestions
DROP CONSTRAINT IF EXISTS daily_sugg_content_type_required;

ALTER TABLE daily_suggestions
ADD CONSTRAINT daily_sugg_content_type_required
  CHECK (content_type IS NOT NULL);

COMMENT ON CONSTRAINT daily_sugg_content_type_required 
  ON daily_suggestions IS 
  'All suggestions must have a content_type for consistent categorization';

-- ── 8. Add menu item requirement for product posts ───────────
ALTER TABLE daily_suggestions
DROP CONSTRAINT IF EXISTS daily_sugg_product_needs_menu;

ALTER TABLE daily_suggestions
ADD CONSTRAINT daily_sugg_product_needs_menu
  CHECK (
    content_type NOT IN ('product', 'occasion')
    OR menu_item_name IS NOT NULL
  );

COMMENT ON CONSTRAINT daily_sugg_product_needs_menu 
  ON daily_suggestions IS 
  'Product and occasion suggestions must reference a menu item';

-- ── 9. Add valid content types enum ───────────────────────────
ALTER TABLE daily_suggestions
DROP CONSTRAINT IF EXISTS daily_sugg_valid_content_types;

ALTER TABLE daily_suggestions
ADD CONSTRAINT daily_sugg_valid_content_types
  CHECK (
    content_type IN (
      'product',
      'experience',
      'occasion',
      'atmosphere',
      'retention',
      'team'
    )
  );

-- ── 10. Add index for quick lookups ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_menu_item
  ON daily_suggestions(business_id, menu_item_name, created_at DESC)
  WHERE menu_item_name IS NOT NULL;

COMMENT ON INDEX idx_daily_suggestions_menu_item IS 
  'Fast lookup: which dishes were recently suggested (avoid re-suggesting)';

-- ── 11. Add index for service period filtering ───────────────
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_service_period
  ON daily_suggestions(business_id, service_period, created_at DESC)
  WHERE service_period IS NOT NULL;

COMMENT ON INDEX idx_daily_suggestions_service_period IS 
  'Fast lookup: get suggestions for current service period (brunch/lunch/dinner)';

-- ── 12. Verify schema changes ─────────────────────────────────
SELECT 
  'Migration completed successfully!' AS message,
  COUNT(*) FILTER (WHERE column_name = 'menu_item_id') AS menu_item_id_col,
  COUNT(*) FILTER (WHERE column_name = 'menu_item_name') AS menu_item_name_col,
  COUNT(*) FILTER (WHERE column_name = 'content_type') AS content_type_col,
  COUNT(*) FILTER (WHERE column_name = 'service_period') AS service_period_col,
  COUNT(*) FILTER (WHERE column_name = 'content_angle') AS content_angle_col
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'daily_suggestions'
  AND column_name IN ('menu_item_id', 'menu_item_name', 'content_type', 'service_period', 'content_angle');

-- Expected result: All columns should show "1"

-- ── 13. Verify constraints ────────────────────────────────────
SELECT 
  'Constraints added' AS check_type,
  COUNT(*) FILTER (WHERE constraint_name = 'daily_sugg_content_type_required') AS content_type_required,
  COUNT(*) FILTER (WHERE constraint_name = 'daily_sugg_product_needs_menu') AS product_needs_menu,
  COUNT(*) FILTER (WHERE constraint_name = 'daily_sugg_valid_content_types') AS valid_types
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'daily_suggestions'
  AND constraint_name LIKE 'daily_sugg%';

-- Expected: All constraints should show "1"
