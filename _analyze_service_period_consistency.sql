-- Analyze service period data consistency across tables

-- 1. What service periods exist in menu_items_normalized?
SELECT DISTINCT
  service_period_name,
  service_periods,
  COUNT(*) as items
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND is_active = true
GROUP BY service_period_name, service_periods
ORDER BY items DESC;

-- 2. What programmes exist in business_programme_profiles?
SELECT 
  programme_type,
  programme_name,
  time_windows,
  operating_days
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY programme_type;

-- 3. Check business metadata (to understand venue type for category filtering)
SELECT 
  business_archetype
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 3a. Check opening hours
SELECT 
  weekday,
  open_time,
  close_time,
  closed
FROM opening_hours
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY weekday;

-- 3b. Check kitchen operations
SELECT 
  kitchen_close_time
FROM business_operations
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 4. Count menu items by service period
SELECT 
  UNNEST(service_periods) as period,
  category_type,
  COUNT(*) as count
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND is_active = true
GROUP BY period, category_type
ORDER BY period, category_type;

-- 5. Check for orphaned service periods (in menu but not in programmes)
SELECT DISTINCT
  UNNEST(service_periods) as menu_period
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND is_active = true
EXCEPT
SELECT programme_type
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
