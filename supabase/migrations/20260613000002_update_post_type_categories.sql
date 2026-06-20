-- Update post_type categories to simplified 5-category system
-- Removes: announcement, customer_moment, team, seasonal, branding
-- Keeps: menu_item, atmosphere, behind_the_scenes, event, other

COMMENT ON COLUMN media_library.post_type IS 'Category: menu_item, atmosphere, behind_the_scenes, event, other';

-- Update thumbnail_path comment to reflect new 400px size (from 150px)
COMMENT ON COLUMN media_library.thumbnail_path IS 'Path to 400x400 thumbnail for gallery display (upgraded from 150px for better quality)';
