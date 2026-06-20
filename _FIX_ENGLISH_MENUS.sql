-- Fix the 2 English menus that are incorrectly marked as 'da'
-- Strategy: Check URL path (/english-menu/) + English sentence patterns ("served with", "with", "and")
-- Exclude cocktail menus (use international names but Danish descriptions)

-- Step 1: Identify the 2 English menus
WITH english_menu_detection AS (
  SELECT 
    id,
    source_url,
    service_period_name,
    language_code as current_lang,
    -- Check if URL contains /english-menu/
    CASE WHEN source_url ILIKE '%/english-menu/%' THEN true ELSE false END as url_is_english,
    -- Check if it's a cocktail menu (international names are normal)
    CASE WHEN service_period_name ILIKE '%cocktail%' OR 
              (structured_data->>'menuTitle') ILIKE '%cocktail%' 
         THEN true ELSE false END as is_cocktail,
    -- Count strong English sentence patterns (not just single words)
    (
      SELECT COUNT(*)
      FROM jsonb_array_elements(structured_data->'categories') AS cat,
           jsonb_array_elements(cat->'items') AS item
      WHERE 
        (item->>'description') ILIKE '%served with%' OR
        (item->>'description') ILIKE '% with %' OR
        (item->>'description') ILIKE '%fried egg%' OR
        (item->>'description') ILIKE '%scrambled egg%' OR
        (item->>'description') ILIKE '%grilled lemon%' OR
        (item->>'description') ILIKE '%fresh baked%' OR
        (item->>'description') ILIKE '%boiled potatoes%'
    ) as english_pattern_count,
    -- Sample description
    (structured_data->'categories'->0->'items'->0->>'description') as sample_desc
  FROM menu_results_v2
  WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
    AND status = 'done'
)
SELECT 
  id,
  service_period_name,
  current_lang,
  url_is_english,
  is_cocktail,
  english_pattern_count,
  CASE 
    WHEN is_cocktail THEN '🍸 Cocktail (Keep DA)'
    WHEN url_is_english OR english_pattern_count > 5 THEN '🔴 Should be EN' 
    ELSE '✅ Correct DA' 
  END as should_be,
  LEFT(sample_desc, 80) as sample_desc
FROM english_menu_detection
ORDER BY url_is_english DESC, english_pattern_count DESC;

-- Step 2: UPDATE the 2 English menus (EXECUTE THIS)
-- Only updates menus from /english-menu/ URLs OR with high English pattern count
-- Excludes cocktail menus (they use international names but are Danish)
UPDATE menu_results_v2
SET language_code = 'en'
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND status = 'done'
  AND id IN (
    -- Select IDs that are clearly English (from URL or patterns) but NOT cocktails
    SELECT id
    FROM (
      SELECT 
        id,
        source_url,
        service_period_name,
        structured_data,
        -- Check URL
        CASE WHEN source_url ILIKE '%/english-menu/%' THEN true ELSE false END as url_is_english,
        -- Check if cocktail menu
        CASE WHEN service_period_name ILIKE '%cocktail%' OR 
                  (structured_data->>'menuTitle') ILIKE '%cocktail%' 
             THEN true ELSE false END as is_cocktail,
        -- Count English sentence patterns
        (
          SELECT COUNT(*)
          FROM jsonb_array_elements(structured_data->'categories') AS cat,
               jsonb_array_elements(cat->'items') AS item
          WHERE 
            (item->>'description') ILIKE '%served with%' OR
            (item->>'description') ILIKE '% with %' OR
            (item->>'description') ILIKE '%fried egg%' OR
            (item->>'description') ILIKE '%scrambled egg%' OR
            (item->>'description') ILIKE '%grilled lemon%' OR
            (item->>'description') ILIKE '%fresh baked%' OR
            (item->>'description') ILIKE '%boiled potatoes%'
        ) as english_pattern_count
      FROM menu_results_v2
      WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
        AND status = 'done'
    ) subq
    WHERE (url_is_english OR english_pattern_count > 5) 
      AND NOT is_cocktail
  );

-- Step 3: Verify the fix
SELECT 
  language_code,
  COUNT(*) as menu_count,
  STRING_AGG(DISTINCT service_period_name, ', ' ORDER BY service_period_name) as service_periods
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND status = 'done'
GROUP BY language_code
ORDER BY language_code;

-- Step 4: Show which specific menus were updated
SELECT 
  id::text as menu_id,
  language_code,
  service_period_name,
  (structured_data->'categories'->0->'items'->0->>'name') as sample_dish,
  (structured_data->'categories'->0->'items'->0->>'description') as sample_description
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND status = 'done'
ORDER BY language_code, service_period_name;
