-- =====================================================
-- CHECK AND FIX LANGUAGE DETECTION FOR CAFÉ FAUST
-- =====================================================

-- Step 1: Check current language_code in menu_results_v2
SELECT 
  id,
  source_url,
  language_code,
  service_period_name,
  status
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid
ORDER BY source_url;

-- Step 2: Fix English menu (URL contains '/english-menu/')
UPDATE menu_results_v2
SET language_code = 'en'
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid
  AND source_url LIKE '%/english-menu/%'
  AND language_code != 'en';

-- Step 3: Fix Danish menus (URL doesn't contain language indicator)
UPDATE menu_results_v2
SET language_code = 'da'
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid
  AND source_url NOT LIKE '%/english-menu/%'
  AND source_url NOT LIKE '%/en/%'
  AND language_code != 'da';

-- Step 4: Propagate to menu_items_normalized
UPDATE menu_items_normalized min
SET menu_language = mr.language_code
FROM menu_results_v2 mr
WHERE min.menu_result_id = mr.id
  AND min.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid
  AND min.menu_language IS DISTINCT FROM mr.language_code;

-- Step 5: Verify the fix
SELECT 
  menu_language,
  COUNT(*) as item_count,
  array_agg(DISTINCT menu_url) as urls
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid
GROUP BY menu_language
ORDER BY menu_language;

-- Step 6: Sample check - show some English items
SELECT 
  item_name,
  item_description,
  menu_language,
  menu_url
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'::uuid
  AND menu_url LIKE '%/english-menu/%'
LIMIT 5;
