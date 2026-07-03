-- Check ALL category scores after force refresh for Café Faust
SELECT 
  key as category,
  value::text::numeric as score
FROM business_location_intelligence,
  jsonb_each(category_scores)
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY (value::text::numeric) DESC;

-- Check if shopping_district or other categories should be >= 60%
SELECT 
  'Total categories' as metric,
  COUNT(*) as count
FROM business_location_intelligence,
  jsonb_each(category_scores)
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

SELECT 
  'Categories >= 60%' as metric,
  COUNT(*) as count
FROM business_location_intelligence,
  jsonb_each(category_scores)
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND (value::text::numeric) >= 60;

SELECT 
  'Categories >= 40% but < 60%' as metric,
  COUNT(*) as count
FROM business_location_intelligence,
  jsonb_each(category_scores)
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND (value::text::numeric) >= 40
  AND (value::text::numeric) < 60;
