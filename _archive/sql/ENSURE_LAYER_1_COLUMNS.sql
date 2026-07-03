-- ============================================================================
-- ENSURE LAYER 1 COLUMNS EXIST
-- ============================================================================
-- Purpose: Add any missing columns needed for Layer 1 functionality
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================================

-- ============================================================================
-- 1. BUSINESSES TABLE - Add selected_platforms
-- ============================================================================

-- Add selected_platforms as JSONB (stores array like ["instagram", "facebook"])
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS selected_platforms JSONB DEFAULT '["instagram", "facebook"]'::jsonb;

COMMENT ON COLUMN businesses.selected_platforms IS 
'Array of selected social media platforms (e.g., ["instagram", "facebook", "linkedin"])';

-- ============================================================================
-- 2. BUSINESS_LOCATION_INTELLIGENCE - Add category_scores
-- ============================================================================

-- Add category_scores (location type scoring: waterfront, city_center, etc.)
ALTER TABLE business_location_intelligence 
ADD COLUMN IF NOT EXISTS category_scores JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN business_location_intelligence.category_scores IS 
'Location category scores (0-100) for each location type: 
{"waterfront": 85, "city_center": 60, "tourist_area": 40, etc.}';

-- ============================================================================
-- 3. BUSINESS_OPERATIONS - Add establishment_type
-- ============================================================================

-- Add establishment_type column
ALTER TABLE business_operations 
ADD COLUMN IF NOT EXISTS establishment_type VARCHAR(10);

-- Drop old constraint if exists
ALTER TABLE business_operations 
DROP CONSTRAINT IF EXISTS establishment_type_check;

-- Add constraint with full business type taxonomy
ALTER TABLE business_operations 
ADD CONSTRAINT establishment_type_check 
CHECK (establishment_type IS NULL OR establishment_type IN ('FSE', 'SBO', 'MFV', 'MFD', 'QSR'));

COMMENT ON COLUMN business_operations.establishment_type IS 
'Business type classification:
- FSE: Full-Service Establishment (fine dining, sit-down restaurants)
- SBO: Service-Based Operation (cafes, small restaurants)
- MFV: Mobile Food Vendor (food trucks)
- MFD: Multi-location/Multi-per-Day (chains, multiple daily posts)
- QSR: Quick Service Restaurant (fast food)';

-- ============================================================================
-- 4. BUSINESS_OPERATIONS - Add has_outdoor_seating
-- ============================================================================

-- Add outdoor seating flag (important for seasonal content boost)
ALTER TABLE business_operations 
ADD COLUMN IF NOT EXISTS has_outdoor_seating BOOLEAN DEFAULT false;

COMMENT ON COLUMN business_operations.has_outdoor_seating IS 
'Whether the business offers outdoor seating/serving (terrace, patio, etc.). 
Used to boost seasonal content in Q2-Q3.';

-- ============================================================================
-- 5. VERIFICATION - Check all columns exist
-- ============================================================================

-- Verify businesses.selected_platforms
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' 
    AND column_name = 'selected_platforms'
  ) THEN
    RAISE NOTICE '✅ businesses.selected_platforms exists';
  ELSE
    RAISE EXCEPTION '❌ businesses.selected_platforms MISSING';
  END IF;
END $$;

-- Verify business_location_intelligence.category_scores
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_location_intelligence' 
    AND column_name = 'category_scores'
  ) THEN
    RAISE NOTICE '✅ business_location_intelligence.category_scores exists';
  ELSE
    RAISE EXCEPTION '❌ business_location_intelligence.category_scores MISSING';
  END IF;
END $$;

-- Verify business_operations.establishment_type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_operations' 
    AND column_name = 'establishment_type'
  ) THEN
    RAISE NOTICE '✅ business_operations.establishment_type exists';
  ELSE
    RAISE EXCEPTION '❌ business_operations.establishment_type MISSING';
  END IF;
END $$;

-- Verify business_operations.has_outdoor_seating
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_operations' 
    AND column_name = 'has_outdoor_seating'
  ) THEN
    RAISE NOTICE '✅ business_operations.has_outdoor_seating exists';
  ELSE
    RAISE EXCEPTION '❌ business_operations.has_outdoor_seating MISSING';
  END IF;
END $$;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'LAYER 1 COLUMNS VERIFIED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All required Layer 1 columns exist.';
  RAISE NOTICE 'You can now run TEST_LAYER_1_DATABASE.sql';
  RAISE NOTICE '========================================';
END $$;
