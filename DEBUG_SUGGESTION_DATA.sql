-- INSTRUCTIONS FOR USER:
-- Run these queries in Supabase SQL Editor to debug the FALAFEL BURGER / omelet mismatch

-- ==================================================================
-- Query 1: Check what data is in the daily_suggestions table
-- ==================================================================
SELECT 
  id,
  title,
  menu_item_name,
  LEFT(menu_item_description, 100) as menu_desc_preview,
  content_type,
  suggestion_date,
  is_active
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND is_active = true
  AND suggestion_date >= CURRENT_DATE - INTERVAL '2 days'
ORDER BY created_at DESC;

-- ==================================================================
-- Query 2: Check what menu items exist
-- ==================================================================
SELECT 
  item_name,
  LEFT(item_description, 80) as desc_preview,
  menu_name
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY item_name;

-- ==================================================================
-- Query 3: Find the specific FALAFEL BURGER suggestion
-- ==================================================================
SELECT 
  id,
  title,
  menu_item_name,
  menu_item_description,
  caption_base,
  content_type
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND (title ILIKE '%FALAFEL%' OR title ILIKE '%falafel%')
  AND is_active = true
ORDER BY created_at DESC
LIMIT 1;
