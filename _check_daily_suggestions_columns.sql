-- =====================================================
-- CHECK daily_suggestions TABLE SCHEMA
-- =====================================================
-- Run this in Supabase SQL Editor to verify all columns exist
-- =====================================================

-- 1. Check if all required columns exist
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'daily_suggestions'
  AND column_name IN (
    'generated_text',
    'generated_hashtags',
    'generated_platform_content',
    'generated_at',
    'platforms_generated',
    'text_generation_version'
  )
ORDER BY column_name;

-- 2. Check RLS policies on daily_suggestions
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'daily_suggestions'
ORDER BY policyname;

-- 3. Try a test update (replace YOUR_BUSINESS_ID and SUGGESTION_ID)
-- This will show if the columns accept the data types we're sending
-- 
-- UPDATE daily_suggestions
-- SET 
--   generated_text = 'test',
--   generated_hashtags = '[]'::jsonb,
--   generated_platform_content = '{}'::jsonb,
--   generated_at = NOW(),
--   platforms_generated = ARRAY['facebook', 'instagram'],
--   text_generation_version = 8
-- WHERE id = YOUR_SUGGESTION_ID
--   AND business_id = 'YOUR_BUSINESS_ID';

-- =====================================================
-- EXPECTED RESULTS:
-- - All 6 columns should be listed in query 1
-- - Query 2 should show RLS policies (might block updates)
-- =====================================================
