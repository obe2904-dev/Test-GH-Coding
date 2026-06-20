-- Run this migration to update post_type categories
-- Execute in Supabase SQL Editor

-- Update post_type categories to simplified 5-category system
-- Removes: announcement, customer_moment, team, seasonal, branding
-- Keeps: menu_item, atmosphere, behind_the_scenes, event, other

COMMENT ON COLUMN media_library.post_type IS 'Category: menu_item, atmosphere, behind_the_scenes, event, other';

-- Update thumbnail_path comment to reflect new 400px size (from 150px)
COMMENT ON COLUMN media_library.thumbnail_path IS 'Path to 400x400 thumbnail for gallery display (upgraded from 150px for better quality)';

-- Optional: Check if any existing records use removed categories
-- (for information only - no need to update since post_type has no constraint)
SELECT post_type, COUNT(*) as count
FROM media_library
WHERE post_type IN ('announcement', 'customer_moment', 'team', 'seasonal', 'branding')
  AND deleted_at IS NULL
GROUP BY post_type;

-- Note: Existing records with removed post_type values will continue to work.
-- They just won't appear in the dropdown anymore. Users can edit them to use new categories.
