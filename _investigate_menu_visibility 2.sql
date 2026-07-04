-- =====================================================
-- MENU VISIBILITY & RECENT DISHES INVESTIGATION
-- =====================================================
-- Checks if AI has access to all menus and dishes
-- Verifies recent dishes tracking is working correctly
-- =====================================================

-- Your test business ID: f4679fa9-3120-4a59-9506-d059b010c34a

-- TEST 1: How many menus does this business have?
SELECT 
  '📋 TEST 1: Total Menus Available' AS test_name,
  COUNT(*) AS total_menus,
  COUNT(*) FILTER (WHERE status = 'done') AS completed_menus,
  COUNT(*) FILTER (WHERE language_code = 'da') AS danish_menus,
  string_agg(DISTINCT service_period_name, ', ') AS service_periods
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- TEST 2: How many dishes are in ALL menus?
SELECT 
  '🍽️ TEST 2: Total Dishes Across All Menus' AS test_name,
  menu.service_period_name,
  menu.start_time,
  menu.end_time,
  jsonb_array_length(menu.structured_data->'categories') AS category_count,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(menu.structured_data->'categories') AS cat,
         jsonb_array_elements(cat->'items') AS item
  ) AS dish_count,
  menu.availability_days
FROM menu_results_v2 AS menu
WHERE menu.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND menu.status = 'done'
  AND menu.language_code = 'da'
ORDER BY menu.start_time NULLS LAST;

-- TEST 3: Check if FAUSTBURGER exists in any menu
SELECT 
  '🔍 TEST 3: FAUSTBURGER in Menus' AS test_name,
  menu.service_period_name,
  cat.value->>'name' AS category_name,
  item.value->>'name' AS dish_name,
  item.value->>'description' AS dish_description
FROM menu_results_v2 AS menu,
     jsonb_array_elements(menu.structured_data->'categories') AS cat,
     jsonb_array_elements(cat->'items') AS item
WHERE menu.business_id = :'business_id'
  AND menu.status = 'done'
  AND UPPER(item.value->>'name') LIKE '%FAUSTBURGER%'
ORDER BY menu.service_period_name;

-- TEST 4: Recent posts from last 14 days
SELECT 
  '📅 TEST 4: Recent Published Posts (Last 14 Days)' AS test_name,
  menu_item_name,
  posted_at::DATE AS posted_date,
  EXTRACT(EPOCH FROM (NOW() - posted_at))/86400 AS days_ago,
  status,
  platform
FROM published_posts
WHERE business_id = :'business_id'
  AND posted_at >= NOW() - INTERVAL '14 days'
  AND status = 'published'
  AND menu_item_name IS NOT NULL
ORDER BY posted_at DESC;

-- TEST 5: Check if FAUSTBURGER was posted recently
SELECT 
  '🔍 TEST 5: FAUSTBURGER Recent Posts' AS test_name,
  menu_item_name,
  posted_at,
  EXTRACT(EPOCH FROM (NOW() - posted_at))/86400 AS days_ago,
  status,
  platform
FROM published_posts
WHERE business_id = :'business_id'
  AND UPPER(menu_item_name) LIKE '%FAUSTBURGER%'
  AND posted_at >= NOW() - INTERVAL '14 days'
ORDER BY posted_at DESC;

-- TEST 6: Recent AI suggestions from last 14 days
SELECT 
  '🤖 TEST 6: Recent AI Suggestions (Last 14 Days)' AS test_name,
  menu_item_name,
  created_at::DATE AS suggested_date,
  EXTRACT(EPOCH FROM (NOW() - created_at))/86400 AS days_ago,
  generated_text
FROM daily_suggestions
WHERE business_id = :'business_id'
  AND created_at >= NOW() - INTERVAL '14 days'
  AND menu_item_name IS NOT NULL
ORDER BY created_at DESC;

-- TEST 7: Check if FAUSTBURGER was suggested recently
SELECT 
  '🔍 TEST 7: FAUSTBURGER Recent Suggestions' AS test_name,
  menu_item_name,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/86400 AS days_ago,
  generated_text
FROM daily_suggestions
WHERE business_id = :'business_id'
  AND UPPER(menu_item_name) LIKE '%FAUSTBURGER%'
  AND created_at >= NOW() - INTERVAL '14 days'
ORDER BY created_at DESC;

-- TEST 8: All unique dishes that AI could see (from all menus)
SELECT 
  '📊 TEST 8: All Unique Dishes AI Can See' AS test_name,
  COUNT(DISTINCT item.value->>'name') AS unique_dishes,
  jsonb_agg(DISTINCT item.value->>'name' ORDER BY item.value->>'name') AS all_dish_names
FROM menu_results_v2 AS menu,
     jsonb_array_elements(menu.structured_data->'categories') AS cat,
     jsonb_array_elements(cat->'items') AS item
WHERE menu.business_id = :'business_id'
  AND menu.status = 'done'
  AND menu.language_code = 'da'
  AND cat.value->>'name' !~* 'tilkøb|tilbehør|ekstra|tillæg|add.?on|ekstr|side|snack';

-- TEST 9: Dishes by time period (does AI see different dishes at different times?)
SELECT 
  '⏰ TEST 9: Dishes by Service Period' AS test_name,
  COALESCE(menu.service_period_name, 'Uspecified') AS service_period,
  menu.start_time || ' - ' || menu.end_time AS time_range,
  COUNT(DISTINCT item.value->>'name') AS unique_dishes_in_period,
  string_agg(DISTINCT item.value->>'name', ', ') AS sample_dishes
FROM menu_results_v2 AS menu,
     jsonb_array_elements(menu.structured_data->'categories') AS cat,
     jsonb_array_elements(cat->'items') AS item
WHERE menu.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND menu.status = 'done'
  AND menu.language_code = 'da'
GROUP BY menu.service_period_name, menu.start_time, menu.end_time
ORDER BY menu.start_time NULLS LAST;

-- TEST 10: Summary - What should AI know right now?
SELECT 
  '📊 SUMMARY: AI Knowledge Status' AS report,
  (SELECT COUNT(*) FROM menu_results_v2 WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a' AND status = 'done' AND language_code = 'da') AS total_menus,
  (SELECT COUNT(DISTINCT item.value->>'name') FROM menu_results_v2 AS menu, jsonb_array_elements(menu.structured_data->'categories') AS cat, jsonb_array_elements(cat->'items') AS item WHERE menu.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a' AND menu.status = 'done' AND menu.language_code = 'da') AS total_unique_dishes,
  (SELECT COUNT(*) FROM published_posts WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a' AND posted_at >= NOW() - INTERVAL '14 days' AND status = 'published' AND menu_item_name IS NOT NULL) AS recent_posts_14d,
  (SELECT COUNT(*) FROM published_posts WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a' AND posted_at >= CURRENT_DATE - INTERVAL '3 days' AND status = 'published' AND menu_item_name IS NOT NULL) AS recent_posts_0_3_days,
  (SELECT COUNT(*) FROM daily_suggestions WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a' AND created_at >= NOW() - INTERVAL '14 days' AND menu_item_name IS NOT NULL) AS recent_suggestions_14d;
