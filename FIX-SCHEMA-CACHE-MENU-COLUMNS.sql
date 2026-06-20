-- ============================================================================
-- FIX MISSING MENU COLUMNS IN PRODUCTION
-- ============================================================================
-- Problem: Edge Function deployed with code referencing columns that don't 
--          exist in production database, causing PGRST204 errors
-- Solution: Apply missing migrations + refresh PostgREST schema cache
-- ============================================================================

-- STEP 1: Check which columns are missing
SELECT 
  CASE 
    WHEN COUNT(*) = 4 THEN '✅ All columns exist'
    ELSE '❌ Missing columns: ' || (4 - COUNT(*))::text || ' of 4'
  END as status,
  STRING_AGG(column_name, ', ') as existing_columns
FROM information_schema.columns
WHERE table_name = 'menu_results_v2'
  AND column_name IN ('is_signature', 'service_periods', 'service_period_name', 'ai_summary');

-- STEP 2: Apply missing migrations
-- Migration 1: Service period columns (from 20260202000001)
ALTER TABLE menu_results_v2
  ADD COLUMN IF NOT EXISTS service_periods TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS service_period_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_signature BOOLEAN DEFAULT false;

COMMENT ON COLUMN menu_results_v2.service_periods IS 'Array of service periods when this menu is available: brunch, lunch, dinner';
COMMENT ON COLUMN menu_results_v2.service_period_name IS 'Primary service period name for this menu (single value)';
COMMENT ON COLUMN menu_results_v2.is_signature IS 'Whether this menu contains signature/featured dishes';

-- Migration 2: AI summary column (from 20260222000000)
ALTER TABLE menu_results_v2 
  ADD COLUMN IF NOT EXISTS ai_summary TEXT;

COMMENT ON COLUMN menu_results_v2.ai_summary IS 
  'AI-generated 5-bullet helicopter summary of this menu, used in Phase 0 strategy prompts. Generated once after extraction completes.';

-- STEP 3: Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_menu_results_v2_service_periods 
  ON menu_results_v2 USING GIN(service_periods);

CREATE INDEX IF NOT EXISTS idx_menu_results_v2_signature 
  ON menu_results_v2(business_id, is_signature) 
  WHERE is_signature = true;

-- STEP 4: Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- STEP 5: Verify all columns now exist
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'menu_results_v2'
  AND column_name IN ('is_signature', 'service_periods', 'service_period_name', 'ai_summary')
ORDER BY column_name;

-- Expected result: 4 rows (all columns exist)
SELECT 'Schema fix completed - menu extraction should now work' AS status;
