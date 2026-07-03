-- =====================================================
-- FIX CAFE FAUST MENU DATA
-- Correct cocktails menu classification
-- Date: 2. juni 2026
-- =====================================================

-- PROBLEM: Cocktails menu has wrong service_period_name
-- Current: service_period_name = 'brunch' ❌
-- Should be: service_period_name = 'bar' or 'cocktails' ✅

-- Find the cocktails menu for Cafe Faust
SELECT 
  mr.id,
  mr.service_period_name,
  mr.structured_data->>'menuTitle' as menu_title,
  ms.label as source_label,
  ms.source_url
FROM menu_results_v2 mr
JOIN menu_sources ms ON mr.source_id = ms.id
WHERE ms.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND ms.label = 'Cocktails';

-- Update the service_period_name to match the label
UPDATE menu_results_v2
SET 
  service_period_name = 'bar',
  service_periods = ARRAY['bar']::text[]
WHERE id IN (
  SELECT mr.id
  FROM menu_results_v2 mr
  JOIN menu_sources ms ON mr.source_id = ms.id
  WHERE ms.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
    AND ms.label = 'Cocktails'
);

-- Verify the fix
SELECT 
  mr.id,
  mr.service_period_name as new_period_name,
  mr.service_periods as new_periods_array,
  mr.structured_data->>'menuTitle' as menu_title,
  ms.label as source_label,
  ms.source_url
FROM menu_results_v2 mr
JOIN menu_sources ms ON mr.source_id = ms.id
WHERE ms.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND ms.label = 'Cocktails';

-- Expected result:
-- service_period_name = 'bar' ✅
-- service_periods = ['bar'] ✅
