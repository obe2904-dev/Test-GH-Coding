-- Run this in Supabase SQL Editor to verify photo analysis setup

-- 1. Check if columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'daily_suggestions' 
AND column_name IN ('uploaded_photo_url', 'photo_analysis')
ORDER BY column_name;

-- 2. Check RLS policies on daily_suggestions
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'daily_suggestions'
ORDER BY cmd, policyname;

-- 3. Test updating a row (replace 'your-suggestion-id' with an actual ID)
-- UPDATE daily_suggestions 
-- SET uploaded_photo_url = 'https://test.com/photo.jpg',
--     photo_analysis = '{"test": "data"}'::jsonb
-- WHERE id = 'your-suggestion-id';

-- 4. Verify the update worked
-- SELECT id, title, uploaded_photo_url, photo_analysis
-- FROM daily_suggestions 
-- WHERE id = 'your-suggestion-id';
