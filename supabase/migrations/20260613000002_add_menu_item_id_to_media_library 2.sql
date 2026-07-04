-- =====================================================
-- Add menu_item_id to media_library
-- =====================================================
-- Purpose: Link media items to menu_items_normalized to derive
-- media category from menu item classification (FOOD/DRINK)
-- =====================================================

-- Add menu_item_id column
ALTER TABLE media_library 
  ADD COLUMN IF NOT EXISTS menu_item_id UUID REFERENCES menu_items_normalized(id) ON DELETE SET NULL;

-- Create index for efficient JOINs
CREATE INDEX IF NOT EXISTS idx_media_library_menu_item_id 
  ON media_library(menu_item_id) 
  WHERE deleted_at IS NULL AND menu_item_id IS NOT NULL;

-- Update column comment
COMMENT ON COLUMN media_library.menu_item_id IS 
  'Reference to menu_items_normalized - when set, category is derived from menu item media_category (FOOD/DRINK)';

-- =====================================================
-- Create a view for media with resolved categories
-- =====================================================
-- This view combines media_library with menu_items_normalized
-- to provide a resolved category field
CREATE OR REPLACE VIEW media_library_with_category AS
SELECT 
  ml.*,
  -- Derive category from menu item if linked, otherwise use post_type
  CASE 
    WHEN ml.menu_item_id IS NOT NULL AND min.media_category IS NOT NULL 
      THEN LOWER(min.media_category)
    ELSE ml.post_type
  END AS resolved_category,
  -- Include menu item details for reference
  min.item_name AS menu_item_name,
  min.media_category AS menu_media_category
FROM media_library ml
LEFT JOIN menu_items_normalized min ON ml.menu_item_id = min.id
WHERE ml.deleted_at IS NULL;

-- Grant access to authenticated users
GRANT SELECT ON media_library_with_category TO authenticated;

-- =====================================================
-- Backfill existing dish_name to menu_item_id
-- =====================================================
-- Match existing dish_name values to menu_items_normalized
-- Only update where there's a clear 1:1 match
UPDATE media_library ml
SET menu_item_id = (
  SELECT id 
  FROM menu_items_normalized min
  WHERE 
    min.business_id::text = ml.business_id
    AND min.item_name ILIKE ml.dish_name
    AND ml.dish_name IS NOT NULL
    AND ml.dish_name != ''
  LIMIT 1
)
WHERE 
  ml.dish_name IS NOT NULL 
  AND ml.dish_name != ''
  AND ml.menu_item_id IS NULL
  AND EXISTS (
    SELECT 1 
    FROM menu_items_normalized min
    WHERE 
      min.business_id::text = ml.business_id
      AND min.item_name ILIKE ml.dish_name
  );

-- Verify migration
SELECT 
  'Total media items' AS metric,
  COUNT(*) as count
FROM media_library
WHERE deleted_at IS NULL

UNION ALL

SELECT 
  'With menu_item_id' AS metric,
  COUNT(*) as count
FROM media_library
WHERE deleted_at IS NULL AND menu_item_id IS NOT NULL

UNION ALL

SELECT 
  'Category: ' || resolved_category AS metric,
  COUNT(*) as count
FROM media_library_with_category
GROUP BY resolved_category
ORDER BY metric;
