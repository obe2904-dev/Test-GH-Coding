-- ============================================================================
-- CAFÉ FAUST VALIDATION TEST
-- 
-- Validates BTS anchor filtering against actual Café Faust data
-- Business ID: 36e24a84-c32d-4123-910a-1bb2e64d34af
-- 
-- Expected Results:
-- 1. No coffee items in menu_items_normalized
-- 2. No coffee categories in menu_results_v2
-- 3. Barista/coffee templates should be BLOCKED by filter
-- 4. Alternative safe BTS anchors should be provided
-- ============================================================================

-- 1. Check menu items for coffee references
SELECT 
  'MENU ITEMS - Coffee Check' as test_category,
  business_id,
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE 
    LOWER(dish_name) LIKE '%kaffe%' 
    OR LOWER(dish_name) LIKE '%coffee%'
    OR LOWER(dish_name) LIKE '%espresso%'
    OR LOWER(dish_name) LIKE '%latte%'
    OR LOWER(dish_name) LIKE '%cappuccino%'
  ) as coffee_items
FROM menu_items_normalized
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af'
GROUP BY business_id;

-- 2. Check all menu items (to see what they DO serve)
SELECT 
  'ACTUAL MENU ITEMS' as test_category,
  service_period,
  dish_name,
  description
FROM menu_items_normalized
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af'
ORDER BY service_period, dish_name
LIMIT 50;

-- 3. Check menu categories from menu_results_v2
SELECT 
  'MENU CATEGORIES' as test_category,
  service_period_label,
  categories
FROM menu_results_v2
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af'
ORDER BY service_period_label;

-- 4. Check business operations (facilities)
SELECT 
  'BUSINESS OPERATIONS' as test_category,
  has_outdoor_seating,
  has_bar,
  seating_type
FROM business_operations
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- 5. Check business type/vertical
SELECT 
  'BUSINESS PROFILE' as test_category,
  effective_vertical,
  business_type
FROM business_brand_profile
WHERE business_id = '36e24a84-c32d-4123-910a-1bb2e64d34af';

-- ============================================================================
-- EXPECTED OUTCOMES:
-- ============================================================================
-- • coffee_items should be 0 (NO COFFEE IN MENU)
-- • Actual menu shows: Pariserbøf, Bøf & bearnaise, Club Sandwich, etc.
-- • Categories likely: Brunch, Frokost, Middag, Bar
-- • has_outdoor_seating: Expected FALSE or NULL
-- • effective_vertical: 'cafe' (triggers cafe BTS templates)
-- 
-- FILTERING VALIDATION:
-- Morning cafe templates include:
--   ❌ "Hvordan starter din dag som ejer/barista?" → BLOCKED (no coffee)
--   ❌ "Kaffen inden kaffen — hvad drikker personalet om morgenen?" → BLOCKED
--   ✅ "Det første hold gæster: hvem er de, og hvad siger de altid?" → ALLOWED
--   ✅ "Hvad gøres klar inden åbning — det ingen gæster ser" → ALLOWED
-- 
-- ✅ EXPECTED: 2 barista templates filtered, 2 safe templates allowed
-- ============================================================================
