-- Check if FAUSTBURGER is being tracked correctly
-- Business ID: f4679fa9-3120-4a59-9506-d059b010c34a

-- 1. Is FAUSTBURGER in any menu?
SELECT 
  '1️⃣ FAUSTBURGER in menus?' AS check,
  COUNT(*) AS found_in_menus
FROM menu_results_v2 AS menu,
     jsonb_array_elements(menu.structured_data->'categories') AS cat,
     jsonb_array_elements(cat->'items') AS item
WHERE menu.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND menu.status = 'done'
  AND UPPER(item.value->>'name') LIKE '%FAUSTBURGER%';

-- 2. Was FAUSTBURGER posted in last 14 days?
SELECT 
  '2️⃣ FAUSTBURGER posts (last 14d)' AS check,
  COUNT(*) AS post_count,
  MAX(posted_at) AS most_recent,
  EXTRACT(EPOCH FROM (NOW() - MAX(posted_at)))/86400 AS days_ago
FROM published_posts
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND UPPER(menu_item_name) LIKE '%FAUSTBURGER%'
  AND posted_at >= NOW() - INTERVAL '14 days'
  AND status = 'published';

-- 3. Was FAUSTBURGER suggested in last 14 days?
SELECT 
  '3️⃣ FAUSTBURGER suggestions (last 14d)' AS check,
  COUNT(*) AS suggestion_count,
  MAX(created_at) AS most_recent,
  EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))/86400 AS days_ago
FROM daily_suggestions
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND UPPER(menu_item_name) LIKE '%FAUSTBURGER%'
  AND created_at >= NOW() - INTERVAL '14 days';

-- 4. All recent posts (0-3 days) that should be FORBIDDEN
SELECT 
  '4️⃣ ALL posts 0-3 days (FORBIDDEN)' AS check,
  menu_item_name,
  posted_at,
  ROUND(EXTRACT(EPOCH FROM (NOW() - posted_at))/86400) AS days_ago
FROM published_posts
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND posted_at >= CURRENT_DATE - INTERVAL '3 days'
  AND status = 'published'
  AND menu_item_name IS NOT NULL
ORDER BY posted_at DESC;

-- 5. Total dishes available to AI
SELECT 
  '5️⃣ Total unique dishes AI can see' AS check,
  COUNT(DISTINCT item.value->>'name') AS total_dishes
FROM menu_results_v2 AS menu,
     jsonb_array_elements(menu.structured_data->'categories') AS cat,
     jsonb_array_elements(cat->'items') AS item
WHERE menu.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND menu.status = 'done'
  AND menu.language_code = 'da';

-- 6. How many menus?
SELECT 
  '6️⃣ Total menus' AS check,
  COUNT(*) AS menu_count,
  string_agg(DISTINCT service_period_name, ', ') AS periods
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND status = 'done'
  AND language_code = 'da';
