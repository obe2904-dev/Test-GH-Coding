-- ============================================================================
-- FIX: Add missing commercial_reasoning column to business_programme_profiles
-- ============================================================================
-- Error: "Could not find the 'commercial_reasoning' column of 'business_programme_profiles' in the schema cache"
-- Solution: Add the missing Layer 2 reasoning column
-- ============================================================================

-- Add the missing column
ALTER TABLE business_programme_profiles
ADD COLUMN IF NOT EXISTS commercial_reasoning text;

-- Add comment for documentation
COMMENT ON COLUMN business_programme_profiles.commercial_reasoning IS 'Layer 2: AI explanation of why this commercial orientation was chosen for this programme';

-- ============================================================================
-- CRITICAL: Refresh PostgREST schema cache
-- ============================================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verify column added
-- ============================================================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'business_programme_profiles'
  AND table_schema = 'public'
  AND column_name = 'commercial_reasoning';

-- ============================================================================
-- READY TO TEST
-- ============================================================================
-- After running this, go back to Brand Profile page and click "Generate"
-- The Edge Function should now be able to save the commercial_reasoning field
-- ============================================================================
