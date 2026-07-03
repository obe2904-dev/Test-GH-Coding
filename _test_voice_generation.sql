-- Test what the voice generation query would find

-- Simulate the exact query from brand-profile-generator-v5
SELECT 
  representative_dishes,
  language_code,
  service_period_name,
  completed_at,
  jsonb_array_length(representative_dishes->'dishes') as dish_count
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND language_code = 'da'
  AND status = 'done'
  AND representative_dishes IS NOT NULL
ORDER BY completed_at DESC;

-- Check what dishes would be extracted
SELECT 
  service_period_name,
  dish->>'name' as dish_name,
  dish->>'description' as description
FROM menu_results_v2,
     jsonb_array_elements(representative_dishes->'dishes') as dish
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND language_code = 'da'
  AND status = 'done'
  AND representative_dishes IS NOT NULL
ORDER BY completed_at DESC
LIMIT 3;
