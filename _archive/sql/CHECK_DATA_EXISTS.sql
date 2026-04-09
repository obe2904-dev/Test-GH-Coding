-- Check if there's any data in your brand profile
SELECT 
  business_id,
  brand_essence,
  tone_of_voice,
  things_to_avoid,
  target_audience,
  core_offerings,
  content_focus,
  cta_style,
  communication_goal,
  image_preferences
FROM public.business_brand_profile
WHERE business_id = '82f7b70d-0a72-4888-8ba7-6dc1d34e8db8';

-- This will show what data exists (or all NULLs if empty)
