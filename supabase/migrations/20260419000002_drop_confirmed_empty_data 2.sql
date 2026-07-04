-- ============================================================
-- Drop confirmed-empty engagement tracking columns
-- from menu_items_normalized.
-- Write-back pipeline was never built (§16.9 skipped).
-- Values are null/0 for all businesses.
-- ============================================================
ALTER TABLE menu_items_normalized DROP COLUMN IF EXISTS total_times_posted;
ALTER TABLE menu_items_normalized DROP COLUMN IF EXISTS avg_engagement_rate;
ALTER TABLE menu_items_normalized DROP COLUMN IF EXISTS last_posted_date;

-- ============================================================
-- Drop unused operational planning columns from
-- business_operations. No UI, no write path found in codebase.
-- ============================================================
ALTER TABLE business_operations DROP COLUMN IF EXISTS posting_time_windows;
ALTER TABLE business_operations DROP COLUMN IF EXISTS typical_busy_periods;
ALTER TABLE business_operations DROP COLUMN IF EXISTS typical_slow_periods;

-- ============================================================
-- Drop entire vertical-specific tables with no UI and no
-- write path in any edge function or frontend code.
-- ============================================================
DROP TABLE IF EXISTS business_classes;
DROP TABLE IF EXISTS business_services;
DROP TABLE IF EXISTS business_products;
