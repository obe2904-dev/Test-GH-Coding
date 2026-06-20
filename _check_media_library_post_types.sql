-- Check what post_type values exist in media_library
-- Run this in Supabase SQL Editor

-- 1. Count by post_type (including NULL)
SELECT 
  COALESCE(post_type, '(NULL)') as post_type, 
  COUNT(*) as count
FROM media_library
WHERE deleted_at IS NULL
GROUP BY post_type
ORDER BY count DESC;

-- 2. Show sample records to see what's actually stored
SELECT 
  id,
  dish_name,
  post_type,
  tags,
  upload_date,
  filename
FROM media_library
WHERE deleted_at IS NULL
ORDER BY upload_date DESC
LIMIT 10;

-- 3. Check specifically for menu items (by dish_name presence)
SELECT 
  COUNT(*) as total_with_dish_name,
  COUNT(CASE WHEN post_type = 'menu_item' THEN 1 END) as tagged_as_menu_item,
  COUNT(CASE WHEN post_type IS NULL THEN 1 END) as no_post_type
FROM media_library
WHERE deleted_at IS NULL 
  AND dish_name IS NOT NULL;
