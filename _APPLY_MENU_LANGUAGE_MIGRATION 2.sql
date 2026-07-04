-- =====================================================
-- APPLY menu_language MIGRATION
-- =====================================================
-- Run this in Supabase SQL Editor
-- =====================================================

-- Step 1: Add menu_language column
ALTER TABLE menu_items_normalized 
ADD COLUMN IF NOT EXISTS menu_language TEXT DEFAULT 'da';

-- Step 2: Backfill from menu_results_v2
UPDATE menu_items_normalized min
SET menu_language = COALESCE(mr.language_code, 'da')
FROM menu_results_v2 mr
WHERE min.menu_result_id = mr.id
  AND min.menu_language IS DISTINCT FROM COALESCE(mr.language_code, 'da');

-- Step 3: Create index
CREATE INDEX IF NOT EXISTS idx_menu_items_normalized_language 
ON menu_items_normalized(business_id, menu_language) 
WHERE menu_language IS NOT NULL;

-- Verify
SELECT 
  COUNT(*) as total_items,
  COUNT(menu_language) as with_language,
  COUNT(DISTINCT menu_language) as unique_languages
FROM menu_items_normalized;
