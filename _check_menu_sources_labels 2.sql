-- Check menu_sources labels for Cafe Faust
-- Shows what labels are in the database for drinks detection

-- 1. All menu sources for Cafe Faust
SELECT 
  'MENU SOURCES' as section,
  id,
  label,
  menu_type,
  source_url,
  status
FROM menu_sources
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC;

-- 2. Menu results with joined menu_sources labels
SELECT 
  'MENU RESULTS WITH LABELS' as section,
  mr.service_period_name,
  mr.source_url,
  ms.label as menu_source_label,
  ms.menu_type as menu_source_type,
  CASE 
    WHEN ms.label ILIKE '%cocktail%' OR ms.label ILIKE '%drink%' OR ms.label ILIKE '%wine%' OR ms.label ILIKE '%vin%' OR ms.label ILIKE '%bar%' 
    THEN '🍸 DRINKS-ONLY'
    ELSE '🍽️ FOOD'
  END as detected_type
FROM menu_results_v2 mr
LEFT JOIN menu_sources ms ON mr.source_id = ms.id
WHERE mr.business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND mr.status = 'done'
  AND mr.language_code = 'da'
ORDER BY mr.service_period_name;
