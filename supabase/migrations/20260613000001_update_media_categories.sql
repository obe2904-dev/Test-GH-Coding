-- =====================================================
-- Update Media Library Categories
-- =====================================================
-- Purpose: Replace old post_type categories with new simplified categories:
-- - food (menu items, dishes)
-- - drinks (beverages, cocktails)
-- - atmosphere (ambiance, behind the scenes, events)
-- - other (uncategorized)
-- =====================================================

-- Step 1: Drop the old constraint if it exists
ALTER TABLE media_library 
  DROP CONSTRAINT IF EXISTS media_library_post_type_check;

-- Step 2: Update existing data to new categories
UPDATE media_library
SET post_type = CASE
  WHEN post_type = 'menu_item' THEN 'food'
  WHEN post_type = 'behind_the_scenes' THEN 'atmosphere'
  WHEN post_type = 'event' THEN 'atmosphere'
  WHEN post_type = 'other' THEN 'other'
  WHEN post_type IS NULL THEN NULL
  ELSE 'other'
END
WHERE post_type IS NOT NULL;

-- Step 3: Add the new constraint with updated categories
ALTER TABLE media_library 
  ADD CONSTRAINT media_library_post_type_check 
  CHECK (post_type IS NULL OR post_type IN ('food', 'drinks', 'atmosphere', 'other'));

-- Update column comment
COMMENT ON COLUMN media_library.post_type IS 'Media category: food, drinks, atmosphere, other';

-- Verify migration
SELECT 
  post_type,
  COUNT(*) as count
FROM media_library
WHERE deleted_at IS NULL
GROUP BY post_type
ORDER BY count DESC;
