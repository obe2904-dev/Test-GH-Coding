-- 4D: Add kitchen_close_time column to business_operations.
-- Stores the time the kitchen closes (HH:MM, 24-hour format), which may differ
-- from the venue closing time. When the gap between kitchen close and venue close
-- is ≥ 90 minutes, Dagens Forslag injects a "bar open after kitchen" confirmed fact.
ALTER TABLE business_operations
  ADD COLUMN IF NOT EXISTS kitchen_close_time TEXT;

COMMENT ON COLUMN business_operations.kitchen_close_time IS
  'Time the kitchen closes in HH:MM 24-hour format. May be earlier than the venue closing time (bar stays open after kitchen closes).';
