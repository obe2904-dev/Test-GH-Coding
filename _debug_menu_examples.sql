-- Debug menu examples issue

-- 1. Check business language
SELECT id, name, language FROM businesses WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 2. Check menu_results_v2 for representative_dishes
SELECT 
  id,
  service_period_name,
  language_code,
  status,
  completed_at,
  CASE 
    WHEN representative_dishes IS NULL THEN 'NULL'
    WHEN representative_dishes->>'dishes' IS NULL THEN 'EMPTY OBJECT'
    ELSE jsonb_array_length(representative_dishes->'dishes')::text || ' dishes'
  END as dish_count,
  representative_dishes
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY completed_at DESC
LIMIT 5;

-- 3. Check brand_profile_v5 for menu_description_examples
SELECT 
  CASE 
    WHEN brand_profile_v5 IS NULL THEN 'brand_profile_v5 IS NULL'
    WHEN brand_profile_v5->'voice' IS NULL THEN 'voice IS NULL'
    WHEN brand_profile_v5->'voice'->'menu_description_examples' IS NULL THEN 'menu_description_examples IS NULL'
    ELSE jsonb_array_length(brand_profile_v5->'voice'->'menu_description_examples')::text || ' examples'
  END as status,
  brand_profile_v5->'voice'->'menu_description_examples' as examples
FROM business_brand_profile
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
