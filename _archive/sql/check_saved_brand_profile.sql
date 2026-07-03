-- Check the saved brand profile for Café Faust
SELECT 
  business_id,
  brand_essence,
  tone_of_voice,
  things_to_avoid,
  target_audience,
  core_offerings,
  content_focus,
  communication_goal,
  created_at,
  updated_at
FROM business_brand_profile
WHERE business_id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8';

-- Check all columns to see what was saved
SELECT *
FROM business_brand_profile
WHERE business_id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8';
