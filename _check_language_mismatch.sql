-- Check language mismatch between business and menu
SELECT 
  'Business' as source,
  primary_language,
  country,
  CASE 
    WHEN primary_language IS NOT NULL THEN primary_language
    WHEN country = 'Sweden' THEN 'sv'
    WHEN country = 'Germany' THEN 'de'
    WHEN country = 'Norway' THEN 'no'
    WHEN country = 'Netherlands' THEN 'nl'
    ELSE 'da'
  END as detected_language
FROM businesses
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a'

UNION ALL

SELECT 
  'Menu: ' || service_period_name as source,
  language_code as primary_language,
  NULL as country,
  language_code as detected_language
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND status = 'done'
  AND representative_dishes IS NOT NULL
ORDER BY source;
