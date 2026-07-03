-- Check if you have multiple dishes with the exact same name
-- This determines if name-based lookup is safe

-- 1. Find any duplicate dish names in current menu
SELECT 
  item_name,
  COUNT(*) as count,
  STRING_AGG(DISTINCT id::TEXT, ', ') as row_ids,
  STRING_AGG(DISTINCT price::TEXT, ', ') as prices,
  STRING_AGG(DISTINCT category, ', ') as categories
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
GROUP BY item_name
HAVING COUNT(*) > 1;

-- 2. If empty result above: name-based lookup is SAFE ✅
-- If results found: we need a composite key (name + category + price)

-- 3. Show current menu structure
SELECT 
  item_name,
  category,
  price,
  service_periods,
  item_description,
  created_at
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY item_name;
