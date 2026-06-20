-- Add dedicated start_time / end_time columns to menu_results_v2
-- These mirror structured_data.startTime/endTime but as proper queryable columns,
-- following the same pattern as service_period_name, language_code, ai_summary etc.

ALTER TABLE menu_results_v2
  ADD COLUMN IF NOT EXISTS start_time TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_time TEXT DEFAULT NULL;

COMMENT ON COLUMN menu_results_v2.start_time IS 'Service start time in HH:MM format (e.g. "09:00"). NULL if not specified on the menu.';
COMMENT ON COLUMN menu_results_v2.end_time   IS 'Service end time in HH:MM format (e.g. "17:30"). NULL if not specified on the menu.';

-- Backfill from existing structured_data for all done rows that have the data
UPDATE menu_results_v2
SET
  start_time = structured_data->>'startTime',
  end_time   = structured_data->>'endTime'
WHERE status = 'done'
  AND structured_data IS NOT NULL
  AND structured_data->>'startTime' IS NOT NULL
  AND start_time IS NULL;

CREATE INDEX IF NOT EXISTS idx_menu_results_v2_start_time
  ON menu_results_v2(business_id, start_time)
  WHERE start_time IS NOT NULL;
