-- Add label column to menu_sources for descriptive menu names
-- This allows AI-detected menu types like "Cocktails", "Frokost", "Aftenmenu"

ALTER TABLE menu_sources 
ADD COLUMN IF NOT EXISTS label TEXT;

COMMENT ON COLUMN menu_sources.label IS 'Descriptive label for the menu (e.g., Cocktails, Frokost, Aftenmenu). Auto-detected from URL patterns.';
