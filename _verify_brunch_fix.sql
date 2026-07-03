-- Verify Step 1: "morning" → "brunch" fix

-- 1. Confirm no "morning" programmes remain
SELECT COUNT(*) as remaining_morning_programmes
FROM business_programme_profiles
WHERE programme_type = 'morning';
-- Expected: 0

-- 2. Confirm brunch programme exists for Cafe Faust
SELECT 
  programme_type,
  programme_name,
  time_windows,
  operating_days
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND programme_type = 'brunch';
-- Expected: 1 row with programme_type = 'brunch'

-- 3. Verify NO orphaned service periods
SELECT DISTINCT
  UNNEST(service_periods) as menu_period
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND is_active = true
EXCEPT
SELECT programme_type
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
-- Expected: 0 rows (no orphaned periods)

-- 4. Count items by service period (should now include brunch)
SELECT 
  UNNEST(service_periods) as period,
  category_type,
  COUNT(*) as count
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND is_active = true
GROUP BY period, category_type
ORDER BY period, category_type;
-- Expected: brunch items should have matching programme
