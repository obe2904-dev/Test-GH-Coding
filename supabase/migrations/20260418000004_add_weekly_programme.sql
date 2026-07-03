-- Add weekly_programme column to business_operations.
-- Free-text field for recurring events and time windows that cannot be scraped
-- from a website: happy hour, quiz night, DJ, live music, brunch every Sunday, etc.
-- Injected as a high-priority Slot B anchor in get-quick-suggestions.
ALTER TABLE business_operations
  ADD COLUMN IF NOT EXISTS weekly_programme TEXT;

COMMENT ON COLUMN business_operations.weekly_programme IS
  'Owner-entered free text describing recurring weekly events and time windows (happy hour, quiz night, DJ, etc.). Used as confirmed Slot B anchors in the idea generator.';
