-- ============================================================================
-- FIX: Add missing Layer 3 identity columns to business_brand_profile
-- ============================================================================
-- Error: "Could not find the 'brand_essence' column of 'business_brand_profile' in the schema cache"
-- Solution: Add the missing Layer 3 identity columns that Edge Function expects
-- ============================================================================

-- Add Layer 3 Identity Profile columns
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS brand_essence text,
ADD COLUMN IF NOT EXISTS positioning text,
ADD COLUMN IF NOT EXISTS core_values text[],
ADD COLUMN IF NOT EXISTS what_makes_us_different text,
ADD COLUMN IF NOT EXISTS identity_confidence numeric(3,2),
ADD COLUMN IF NOT EXISTS identity_reasoning text;

-- Add comments for documentation
COMMENT ON COLUMN business_brand_profile.brand_essence IS 'Layer 3: Core brand essence statement';
COMMENT ON COLUMN business_brand_profile.positioning IS 'Layer 3: Brand positioning statement';
COMMENT ON COLUMN business_brand_profile.core_values IS 'Layer 3: Array of core brand values';
COMMENT ON COLUMN business_brand_profile.what_makes_us_different IS 'Layer 3: Differentiation statement';
COMMENT ON COLUMN business_brand_profile.identity_confidence IS 'Layer 3: AI confidence score (0.0-1.0) for identity analysis';
COMMENT ON COLUMN business_brand_profile.identity_reasoning IS 'Layer 3: AI explanation of how identity was determined';

-- ============================================================================
-- CRITICAL: Refresh PostgREST schema cache
-- ============================================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verify columns added
-- ============================================================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'business_brand_profile'
  AND table_schema = 'public'
  AND column_name IN ('brand_essence', 'positioning', 'core_values', 'what_makes_us_different', 'identity_confidence', 'identity_reasoning')
ORDER BY column_name;

-- ============================================================================
-- READY TO TEST
-- ============================================================================
-- After running this, go back to Brand Profile page and click "Regenerate"
-- The Edge Function should now be able to save all Layer 3 identity fields
-- ============================================================================
