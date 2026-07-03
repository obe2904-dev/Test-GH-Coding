-- =====================================================
-- Add menu_language to menu_items_normalized
-- =====================================================
-- Purpose: Track language of menu items using ISO 639-1 standard
-- Inherits from menu_results_v2.language_code (detected during extraction)
-- Standards: ISO 639-1 (da, en, sv, de, fr, etc.)
-- =====================================================

-- Add menu_language column (ISO 639-1: 'da', 'en', 'sv', etc.)
ALTER TABLE menu_items_normalized
ADD COLUMN IF NOT EXISTS menu_language TEXT DEFAULT 'da';

COMMENT ON COLUMN menu_items_normalized.menu_language IS 
'ISO 639-1 language code inherited from menu_results_v2.language_code. Detected during menu extraction by AI + URL patterns + keyword analysis.';

-- Backfill existing rows from menu_results_v2
UPDATE menu_items_normalized min
SET menu_language = COALESCE(mr.language_code, 'da')
FROM menu_results_v2 mr
WHERE min.menu_result_id = mr.id
  AND min.menu_language IS DISTINCT FROM COALESCE(mr.language_code, 'da');

-- Add index for language-based filtering
CREATE INDEX IF NOT EXISTS idx_menu_items_normalized_language 
ON menu_items_normalized(business_id, menu_language) 
WHERE menu_language IS NOT NULL;

COMMENT ON INDEX idx_menu_items_normalized_language IS 
'Fast lookup for filtering menu items by language (used when business has multi-language menus)';
