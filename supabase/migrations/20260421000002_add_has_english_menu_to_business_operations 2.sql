-- Add has_english_menu to business_operations
-- data-gatherer.ts queries this column but it was never created, causing
-- it to always return undefined (silently ignored by the AI prompt builder).

ALTER TABLE business_operations
  ADD COLUMN IF NOT EXISTS has_english_menu BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN business_operations.has_english_menu IS 'Whether the business offers an English-language menu';
