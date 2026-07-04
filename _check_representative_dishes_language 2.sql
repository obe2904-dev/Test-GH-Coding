-- Check why brand-profile-generator-v5 might not be finding the representative dishes

-- 1. Check what language_code is stored in menu_results_v2
SELECT 
  service_period_name,
  language_code,
  status,
  representative_dishes IS NOT NULL as has_dishes,
  jsonb_array_length(representative_dishes->'dishes') as dish_count,
  representative_dishes->'dishes'->0->>'name' as first_dish
FROM menu_results_v2
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND status = 'done'
ORDER BY completed_at DESC;

-- 2. Check what language the business is using
SELECT 
  id,
  name,
  language
FROM businesses
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 3. Check if voice profile has menu_description_examples
SELECT 
  programme_type,
  jsonb_array_length(voice_profile->'menu_description_examples') as example_count,
  voice_profile->'menu_description_examples'
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY programme_type
LIMIT 1;
