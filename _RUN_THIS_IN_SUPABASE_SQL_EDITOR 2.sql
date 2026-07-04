-- ============================================================================
-- FIX MISSING COLUMNS - Run in Supabase SQL Editor
-- ============================================================================
-- Purpose: Add missing inferred_content_type and validation_result columns
-- Date: 2025-01-15
-- Issue: Weekly plan generation failing due to missing schema columns
-- ============================================================================

-- Add missing columns to daily_suggestions
ALTER TABLE daily_suggestions 
ADD COLUMN IF NOT EXISTS inferred_content_type TEXT;

ALTER TABLE daily_suggestions 
ADD COLUMN IF NOT EXISTS validation_result JSONB;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_content_type 
  ON daily_suggestions(inferred_content_type) 
  WHERE inferred_content_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_suggestions_validation 
  ON daily_suggestions USING GIN (validation_result) 
  WHERE validation_result IS NOT NULL;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- 1. Verify columns were added
SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'daily_suggestions' 
  AND column_name IN ('inferred_content_type', 'validation_result')
ORDER BY column_name;

-- Expected output:
-- column_name            | data_type | is_nullable | column_default
-- -----------------------|-----------| ------------|---------------
-- inferred_content_type  | text      | YES         | NULL
-- validation_result      | jsonb     | YES         | NULL

-- 2. Check indexes were created
SELECT 
  indexname, 
  indexdef
FROM pg_indexes 
WHERE tablename = 'daily_suggestions'
  AND indexname IN ('idx_daily_suggestions_content_type', 'idx_daily_suggestions_validation');

-- 3. Test insert with new columns (should succeed)
-- (Replace business_id with actual test business)
INSERT INTO daily_suggestions (
  business_id,
  title,
  rationale,
  content_type,
  date,
  position,
  source,
  is_active,
  selected,
  inferred_content_type,
  validation_result
) VALUES (
  'f4679fa9-3120-4a59-9506-d059b010c34a',
  'Test Post - DELETE ME',
  'Testing new schema columns',
  'atmosphere',
  CURRENT_DATE + INTERVAL '100 days',  -- Use future date to avoid conflicts
  1,  -- Position must be <= 3 due to check constraint
  'weekly_plan',  -- Valid source: 'weekly_plan' or 'quick_suggestion'
  false,
  false,
  'behind_scenes',
  '{"quality_check": true, "test": true}'::jsonb
) 
ON CONFLICT (business_id, date, position, source) DO UPDATE 
  SET inferred_content_type = EXCLUDED.inferred_content_type,
      validation_result = EXCLUDED.validation_result;

-- 4. Verify test insert worked
SELECT 
  title,
  date,
  inferred_content_type,
  validation_result
FROM daily_suggestions
WHERE title = 'Test Post - DELETE ME'
  AND business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- 5. Clean up test data
DELETE FROM daily_suggestions 
WHERE title = 'Test Post - DELETE ME' 
  AND business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- SUCCESS CHECKLIST
-- ============================================================================
-- ✓ Query 1 shows both columns with data_type text/jsonb
-- ✓ Query 2 shows both indexes created
-- ✓ Query 3 insert succeeds without PGRST204 error
-- ✓ Query 4 returns test row with populated columns
-- ✓ Query 5 cleanup succeeds
-- ✓ Generate new weekly plan for Café Faust (should work now)
-- ============================================================================
