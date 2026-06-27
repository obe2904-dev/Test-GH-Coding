-- Debug: Check what's actually in brand_profile_v5
SELECT 
  business_id,
  brand_profile_v5 IS NOT NULL as has_v5_profile,
  jsonb_object_keys(brand_profile_v5) as top_level_keys
FROM business_brand_profile
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';

-- Check if programmes exist at all in V5
SELECT 
  business_id,
  brand_profile_v5 ? 'programmes' as has_programmes_key,
  jsonb_typeof(brand_profile_v5->'programmes') as programmes_type,
  jsonb_pretty(brand_profile_v5->'programmes') as programmes_content
FROM business_brand_profile
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79';

-- Check business_programme_profiles instead
SELECT 
  programme_type,
  programme_name,
  time_windows,
  baseline_goal_split,
  jsonb_pretty(commercial_orientation) as commercial_orientation
FROM business_programme_profiles
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
ORDER BY programme_type;
