-- ============================================================================
-- DIAGNOSTIC: Check why migration failed
-- ============================================================================

-- 1. Check if table exists
SELECT 
  'Table Existence Check' as test_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'business_brand_profile'
  ) as table_exists;

-- 2. Check current columns
SELECT 
  'Current Columns' as test_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_brand_profile'
ORDER BY ordinal_position;

-- 3. Test adding a single column manually
ALTER TABLE business_brand_profile 
  ADD COLUMN IF NOT EXISTS tone_of_voice TEXT;

-- 4. Verify the single column was added
SELECT 
  'Single Column Test' as test_name,
  COUNT(*) FILTER (WHERE column_name = 'tone_of_voice') as has_tone_of_voice
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_brand_profile';

-- 5. Check for any constraints or policies that might block
SELECT 
  'Table Constraints' as test_name,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'business_brand_profile'::regclass;
