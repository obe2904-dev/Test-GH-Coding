-- Add availability_days to menu_results_v2 (menu-level day restriction)
-- e.g. "dagligt", "mandag-fredag", "onsdag-lørdag"
-- Mirrors structured_data.availabilityDays as a proper queryable column.

ALTER TABLE menu_results_v2
  ADD COLUMN IF NOT EXISTS availability_days TEXT DEFAULT NULL;

COMMENT ON COLUMN menu_results_v2.availability_days IS
  'Days this menu is served, as extracted from the menu text (e.g. "dagligt", "mandag-fredag"). NULL if not specified.';

-- Backfill from existing structured_data
UPDATE menu_results_v2
SET availability_days = structured_data->>'availabilityDays'
WHERE status = 'done'
  AND structured_data IS NOT NULL
  AND structured_data->>'availabilityDays' IS NOT NULL
  AND availability_days IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Add category-level timing to menu_items_normalized
-- A category like TAPAS can have its own day/time restriction independent of
-- the parent menu (e.g. TAPAS: only Wed–Sat even though AFTEN runs every day).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE menu_items_normalized
  ADD COLUMN IF NOT EXISTS category_availability_days TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS category_time_range TEXT DEFAULT NULL;

COMMENT ON COLUMN menu_items_normalized.category_availability_days IS
  'Day restriction for this category (e.g. "onsdag-lørdag" for TAPAS). NULL = same as parent menu.';
COMMENT ON COLUMN menu_items_normalized.category_time_range IS
  'Time range for this category if different from the menu (e.g. "17:30-21:30"). NULL = inherits from menu.';

CREATE INDEX IF NOT EXISTS idx_menu_items_normalized_cat_avail_days
  ON menu_items_normalized(category_availability_days)
  WHERE category_availability_days IS NOT NULL;
