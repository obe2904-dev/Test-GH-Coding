-- ============================================================================
-- FIX: Add missing strategic_coverage column to business_brand_profile
-- ============================================================================
-- Error: "Could not find the 'strategic_coverage' column of 'business_brand_profile' in the schema cache"
-- Solution: Add the missing strategic coverage map column used by brand-profile-generator-v5
-- ============================================================================

-- Add the missing column
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS strategic_coverage JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN business_brand_profile.strategic_coverage IS 'V5 strategic coverage map used for gap-time handling and content planning';

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
WHERE table_name = 'business_brand_profile'
  AND table_schema = 'public'
  AND column_name = 'strategic_coverage';

-- ============================================================================
-- READY TO TEST
-- ============================================================================
-- After applying this migration and refreshing the schema cache,
-- brand-profile-generator-v5 should be able to save the strategic_coverage field.
-- ============================================================================