-- Check category distribution in menu_items_normalized

-- 1. Category types breakdown
SELECT 
  category_type,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND is_active = true
GROUP BY category_type
ORDER BY count DESC;

-- 2. Category names breakdown (original menu categories)
SELECT 
  category_name,
  category_type,
  COUNT(*) as count
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND is_active = true
GROUP BY category_name, category_type
ORDER BY category_type, count DESC;

-- 3. Show which categories are being included in suggestions
SELECT 
  category_type,
  category_name,
  item_name,
  service_periods
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND is_active = true
ORDER BY category_type, category_name, item_name;

-- 4. Check if drinks category exists (should be added to classifyCategoryType)
SELECT DISTINCT
  category_name,
  category_type,
  COUNT(*) as items
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND is_active = true
  AND (
    LOWER(category_name) LIKE '%cocktail%'
    OR LOWER(category_name) LIKE '%drink%'
    OR LOWER(category_name) LIKE '%apéritif%'
    OR LOWER(category_name) LIKE '%vin%'
    OR LOWER(category_name) LIKE '%øl%'
    OR LOWER(category_name) LIKE '%wine%'
    OR LOWER(category_name) LIKE '%beer%'
  )
GROUP BY category_name, category_type;
