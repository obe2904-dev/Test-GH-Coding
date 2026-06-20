-- =====================================================
-- APPLY THIS MIGRATION MANUALLY VIA SUPABASE DASHBOARD
-- =====================================================
-- 
-- Migration: Enforce metadata for AI-generated posts
-- Date: 2026-06-08
-- Purpose: Ensure rotation tracking works by requiring menu_item_name
--          and content_type for all AI-generated posts
--
-- HOW TO APPLY:
-- 1. Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
-- 2. Copy-paste this entire file into the SQL Editor
-- 3. Click "Run" button
-- 4. Verify success in output
--
-- =====================================================

-- ── 1. Backfill content_type for existing AI posts ───────────
-- Set default for existing NULL values before adding constraint
UPDATE published_posts 
SET content_type = 'product'
WHERE content_type IS NULL
  AND idea_source IN ('quick_suggestions', 'weekly_plan');

COMMENT ON COLUMN published_posts.content_type IS 
  'Type of content: product (dish), experience (visit), atmosphere (venue), retention (loyalty), occasion (event), team (behind scenes)';

-- ── 2. Add content_type constraint (AI posts only) ───────────
ALTER TABLE published_posts
DROP CONSTRAINT IF EXISTS content_type_required_for_ai_posts;

ALTER TABLE published_posts
ADD CONSTRAINT content_type_required_for_ai_posts
  CHECK (
    idea_source = 'manual' 
    OR content_type IS NOT NULL
  );

COMMENT ON CONSTRAINT content_type_required_for_ai_posts 
  ON published_posts IS 
  'AI-generated posts (quick_suggestions, weekly_plan) MUST have content_type. Manual posts can be NULL.';

-- ── 3. Add menu item requirement (product posts only) ────────
ALTER TABLE published_posts
DROP CONSTRAINT IF EXISTS menu_item_required_for_ai_product_posts;

ALTER TABLE published_posts
ADD CONSTRAINT menu_item_required_for_ai_product_posts
  CHECK (
    idea_source = 'manual'  -- Manual posts exempt
    OR content_type NOT IN ('product', 'occasion')
    OR menu_item_name IS NOT NULL
  );

COMMENT ON CONSTRAINT menu_item_required_for_ai_product_posts 
  ON published_posts IS 
  'AI product/occasion posts MUST link to menu_items_normalized for rotation tracking. Manual posts exempt.';

-- ── 4. Add valid content types enum ──────────────────────────
ALTER TABLE published_posts
DROP CONSTRAINT IF EXISTS valid_content_types;

ALTER TABLE published_posts
ADD CONSTRAINT valid_content_types
  CHECK (
    content_type IS NULL  -- Allow NULL for manual posts
    OR content_type IN (
      'product',      -- Dish feature
      'experience',   -- Visit occasion/atmosphere  
      'occasion',     -- Event/special moment
      'atmosphere',   -- Venue mood/ambiance
      'retention',    -- Loyalty/community
      'team'          -- Behind the scenes
    )
  );

COMMENT ON CONSTRAINT valid_content_types 
  ON published_posts IS 
  'Enforces valid content_type values for structured post categorization';

-- ── 5. Verify constraints were added ──────────────────────────
SELECT 
  'Migration completed successfully!' AS message,
  COUNT(*) FILTER (WHERE constraint_name = 'content_type_required_for_ai_posts') AS content_type_constraint,
  COUNT(*) FILTER (WHERE constraint_name = 'menu_item_required_for_ai_product_posts') AS menu_item_constraint,
  COUNT(*) FILTER (WHERE constraint_name = 'valid_content_types') AS valid_types_constraint
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'published_posts'
  AND constraint_name IN (
    'content_type_required_for_ai_posts',
    'menu_item_required_for_ai_product_posts',
    'valid_content_types'
  );

-- Expected result: All constraints should show "1"

-- ── 6. Verify existing data quality ───────────────────────────
SELECT 
  'Data quality check' AS check_type,
  COUNT(*) as total_ai_posts,
  COUNT(*) FILTER (WHERE content_type IS NULL) as missing_content_type,
  COUNT(*) FILTER (WHERE content_type IN ('product', 'occasion') AND menu_item_name IS NULL) as product_missing_menu
FROM published_posts
WHERE idea_source IN ('quick_suggestions', 'weekly_plan');

-- Expected: missing_content_type = 0, product_missing_menu = 0 after backfill
