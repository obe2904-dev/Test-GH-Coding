-- ============================================================
-- Test ID-based Menu Item Lookup
-- ============================================================
-- Verify that daily_suggestions has menu_item_id populated
-- and that we can look up full item details by ID

-- 1. Check current active suggestions with IDs
SELECT 
  id,
  title,
  menu_item_id,
  menu_item_name,
  LEFT(menu_item_description, 50) as description_preview
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND is_active = true
ORDER BY created_at DESC
LIMIT 5;

-- 2. For each suggestion, verify we can look up the full menu item by ID
-- Example: AVOCADO suggestion (ID 331, menu_item_id: 2d114433-12b2-4446-9636-5e6b8c43fb11)
SELECT 
  id,
  item_name,
  LEFT(item_description, 80) as description_preview
FROM menu_items_normalized
WHERE id = '2d114433-12b2-4446-9636-5e6b8c43fb11';

-- Expected: Should return the FULL item name and description
-- This eliminates truncation issues (AVOCADO → AVOCADO SANDWICH)

-- 3. Verify ID lookups work for all active suggestions
SELECT 
  s.id as suggestion_id,
  s.title,
  s.menu_item_name as stored_name,
  m.item_name as db_full_name,
  CASE 
    WHEN s.menu_item_name != m.item_name THEN '⚠️ NAME MISMATCH'
    ELSE '✅ OK'
  END as name_check,
  LEFT(m.item_description, 60) as db_description
FROM daily_suggestions s
LEFT JOIN menu_items_normalized m ON s.menu_item_id = m.id
WHERE s.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND s.is_active = true
ORDER BY s.created_at DESC
LIMIT 10;
