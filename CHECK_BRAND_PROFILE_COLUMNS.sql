-- Check if all required brand profile columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_brand_profile'
ORDER BY column_name;

-- Check for any data in the table
SELECT COUNT(*) as total_records FROM public.business_brand_profile;

-- Show sample data (if any)
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
  image_preferences,
  last_edited_by,
  last_edited_at,
  created_at,
  updated_at
FROM public.business_brand_profile
LIMIT 5;
