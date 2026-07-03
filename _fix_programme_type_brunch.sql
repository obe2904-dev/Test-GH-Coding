-- Fix service period mismatch: "morning" → "brunch" 
-- This aligns business_programme_profiles with menu_items_normalized taxonomy

-- 1. Show current state
SELECT 
  programme_type,
  programme_name,
  time_windows,
  business_id
FROM business_programme_profiles
WHERE programme_type = 'morning';

-- 2. Update to canonical taxonomy
UPDATE business_programme_profiles
SET programme_type = 'brunch'
WHERE programme_type = 'morning';

-- 3. Verify fix
SELECT 
  programme_type,
  programme_name,
  time_windows,
  business_id
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY programme_type;

-- 4. Verify no orphaned menu items
SELECT DISTINCT
  UNNEST(service_periods) as menu_period
FROM menu_items_normalized
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND is_active = true
EXCEPT
SELECT programme_type
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
