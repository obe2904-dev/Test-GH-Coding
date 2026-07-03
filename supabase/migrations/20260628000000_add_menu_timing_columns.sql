-- Add menu timing columns to menu_results_v2
-- These columns provide a single source of truth for menu availability timing
-- Extracted from menu text, with business hours as fallback for untimed menus (coffee, wine, etc.)

ALTER TABLE menu_results_v2
  ADD COLUMN IF NOT EXISTS menu_type       TEXT,
  ADD COLUMN IF NOT EXISTS time_start      TEXT,
  ADD COLUMN IF NOT EXISTS time_end        TEXT,
  ADD COLUMN IF NOT EXISTS time_source     TEXT,
  ADD COLUMN IF NOT EXISTS time_confirmed  BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN menu_results_v2.menu_type      IS 'Canonical menu type: lunch|brunch|dinner|all_day|coffee|wine|cocktail|beer|bakery|bar_snacks|drinks|other';
COMMENT ON COLUMN menu_results_v2.time_start     IS 'When this menu starts being served (HH:MM format). From menu text or opening hours.';
COMMENT ON COLUMN menu_results_v2.time_end       IS 'When this menu stops being served (HH:MM format). From menu text or opening hours.';
COMMENT ON COLUMN menu_results_v2.time_source    IS 'Timing source: menu_text | opening_hours_fallback | user_override';
COMMENT ON COLUMN menu_results_v2.time_confirmed IS 'True when user has verified or manually edited timing.';

-- Add format validation constraints
ALTER TABLE menu_results_v2
  ADD CONSTRAINT time_start_format CHECK (time_start ~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]$' OR time_start IS NULL),
  ADD CONSTRAINT time_end_format   CHECK (time_end   ~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]$' OR time_end   IS NULL);

-- Backfill existing done rows from structured_data
-- This will populate timing from existing extraction data
UPDATE menu_results_v2
SET
  menu_type  = COALESCE(
    service_period_name,
    'other'
  ),
  time_start = CASE
    WHEN structured_data->>'startTime' IS NOT NULL
      AND structured_data->>'startTime' != '00:00'
    THEN structured_data->>'startTime'
    ELSE NULL
  END,
  time_end = CASE
    WHEN structured_data->>'endTime' IS NOT NULL
      AND structured_data->>'endTime' != '23:59'
    THEN structured_data->>'endTime'
    ELSE NULL
  END,
  time_source = CASE
    WHEN structured_data->>'startTime' IS NOT NULL
      AND structured_data->>'startTime' != '00:00'
      AND structured_data->>'endTime' IS NOT NULL
      AND structured_data->>'endTime' != '23:59'
    THEN 'menu_text'
    ELSE 'opening_hours_fallback'
  END
WHERE status = 'done'
  AND menu_type IS NULL;
