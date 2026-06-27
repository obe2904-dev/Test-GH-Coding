-- Migration: Replace vertical and category with business_type_hybrid
-- Date: 2026-06-25
-- Purpose: Remove simple string fields and replace with hybrid JSONB structure
--          that properly handles multi-type businesses (cafe+bar, bakery+cafe, etc.)

-- Step 1: Add new business_type_hybrid column
ALTER TABLE businesses 
  ADD COLUMN IF NOT EXISTS business_type_hybrid JSONB;

COMMENT ON COLUMN businesses.business_type_hybrid IS 
  'AI-detected hybrid business type structure: { primary: "cafe", secondary: ["bar"], hybridLabel: "Kaffebar & Bar", cuisineType: "Dansk", conceptTags: ["specialty-coffee"] }. Null if not yet detected.';

-- Step 2: Drop CHECK constraint on vertical if it exists
ALTER TABLE businesses 
  DROP CONSTRAINT IF EXISTS businesses_vertical_check;

-- Step 3: Drop old vertical column (no migration - fresh start)
ALTER TABLE businesses 
  DROP COLUMN IF EXISTS vertical;

-- Step 4: Drop category column if it exists (was incomplete migration)
ALTER TABLE businesses 
  DROP COLUMN IF EXISTS category;

-- Note: No data migration needed - only 1-2 test businesses exist with bad data.
-- New businesses will get proper detection via analyze-website at onboarding.
-- Existing businesses can be manually fixed or will auto-detect on next brand profile refresh.
