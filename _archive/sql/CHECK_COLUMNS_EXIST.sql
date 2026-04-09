-- Step 1: Check what columns currently exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'business_brand_profile' 
  AND table_schema = 'public'
ORDER BY column_name;

-- You should see these NEW columns in the results:
-- brand_essence, tone_of_voice, things_to_avoid, core_offerings, 
-- content_focus, cta_style, communication_goal, image_preferences,
-- last_edited_by, last_edited_at

-- If you DON'T see them, the migration wasn't applied!
