-- Check what category scores are saved for Café Faust
SELECT 
  business_id,
  area_type,
  category_scores,
  location_type_matches,
  concept_fit_by_category,
  jsonb_object_keys(category_scores) as all_categories,
  last_updated_by_ai,
  updated_at
FROM business_location_intelligence
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- Show all categories with their scores
SELECT 
  key as category,
  value as score
FROM business_location_intelligence,
  jsonb_each(category_scores)
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY (value::text::numeric) DESC;
