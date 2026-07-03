-- =====================================================
-- FIX MISSING COLUMNS - ROUND 3
-- =====================================================
-- Missing column: business_brand_profile.core_offerings
-- From migration: 20260117000000_brand_strategy_model.sql
-- =====================================================

-- Add core_offerings column (text array - max 3 items)
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS core_offerings text[];

COMMENT ON COLUMN business_brand_profile.core_offerings IS 
  'Layer 1: Top 3 identity patterns (WHAT defines business). Max 3 items from fixed pool.';

-- Add constraint: max 3 offerings
ALTER TABLE business_brand_profile
  DROP CONSTRAINT IF EXISTS check_core_offerings_max_3;

ALTER TABLE business_brand_profile
  ADD CONSTRAINT check_core_offerings_max_3 
  CHECK (core_offerings IS NULL OR array_length(core_offerings, 1) IS NULL OR array_length(core_offerings, 1) <= 3);

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'business_brand_profile.core_offerings' as fix, 
  CASE WHEN COUNT(*) > 0 THEN '✅ Column added' ELSE '❌ Failed' END as status
FROM information_schema.columns 
WHERE table_name = 'business_brand_profile' AND column_name = 'core_offerings';
