-- =====================================================
-- DROP EMPTY FIELDS - Code Cleanup Migration
-- Migration: 20260623000001_drop_empty_fields_code_cleanup.sql
-- Date: 2026-06-23
-- Purpose: Remove 8 empty fields that pollute code with NULL values
-- 
-- Context: V5 migration cleanup - removing unused/empty fields
-- that create code noise in prompts, type definitions, and queries.
-- 
-- Affected Tables:
-- - business_operations (3 fields)
-- - business_profile (3 fields)
-- - businesses (1 field)
-- - city_context_cache (1 field)
--
-- Total Fields Dropped: 8
-- =====================================================

-- VERIFICATION QUERIES (commented out - run manually before migration)
-- Confirm these fields are truly empty before executing the migration:

/*
SELECT 
  COUNT(*) as total_rows,
  COUNT(typical_busy_periods) as has_busy,
  COUNT(typical_slow_periods) as has_slow,
  COUNT(average_check_per_person) as has_avg_check
FROM business_operations;
-- Expected: has_busy = 0, has_slow = 0, has_avg_check = 0

SELECT 
  COUNT(*) as total_rows,
  COUNT(price_level) as has_price,
  COUNT(ai_brand_context) as has_context,
  COUNT(ai_brand_context_generated_at) as has_timestamp
FROM business_profile;
-- Expected: has_price = 0, has_context = 0, has_timestamp = 0

SELECT 
  COUNT(*) as total_rows,
  COUNT(postal_code) as has_postal
FROM businesses;
-- Expected: has_postal = 0 (or very low, legacy only)

SELECT 
  COUNT(*) as total_rows,
  COUNT(postal_code) as has_postal
FROM city_context_cache;
-- Expected: has_postal = 0
*/

-- =====================================================
-- DROP COMMANDS
-- =====================================================

-- 1. business_operations: Drop 3 unused operational fields
-- Fields: typical_busy_periods, typical_slow_periods, average_check_per_person
-- Reason: Schema-only, no runtime reads, explicitly dropped in previous migrations
ALTER TABLE business_operations
  DROP COLUMN IF EXISTS typical_busy_periods,
  DROP COLUMN IF EXISTS typical_slow_periods,
  DROP COLUMN IF EXISTS average_check_per_person;

COMMENT ON TABLE business_operations IS 'Business operational settings - dropped empty timing fields (typical_busy_periods, typical_slow_periods, average_check_per_person)';

-- 2. business_profile: Drop 3 empty legacy fields
-- Fields: price_level (EMPTY, live data in business_operations.price_level),
--         ai_brand_context, ai_brand_context_generated_at (archive only)
-- 
-- CRITICAL: business_profile.price_level is EMPTY
-- Live price data is in business_operations.price_level (e.g., "moderate")
ALTER TABLE business_profile
  DROP COLUMN IF EXISTS price_level,
  DROP COLUMN IF EXISTS ai_brand_context,
  DROP COLUMN IF EXISTS ai_brand_context_generated_at;

COMMENT ON TABLE business_profile IS 'Business profile data - dropped empty price_level (live in business_operations.price_level) and ai_brand_context fields (archive only)';

-- 3. businesses: Drop empty postal_code
-- Live data is in business_locations.postal_code
-- Reason: All runtime reads use business_locations.postal_code via joins
ALTER TABLE businesses
  DROP COLUMN IF EXISTS postal_code;

COMMENT ON TABLE businesses IS 'Core business entities - dropped empty postal_code (live in business_locations.postal_code)';

-- 4. city_context_cache: Drop empty postal_code
-- Live data comes from business_locations.postal_code via joins
-- Reason: Schema field only, not actively populated or read
ALTER TABLE city_context_cache
  DROP COLUMN IF EXISTS postal_code;

COMMENT ON TABLE city_context_cache IS 'City context cache - dropped empty postal_code (uses business_locations.postal_code via joins)';

-- =====================================================
-- POST-DROP VERIFICATION (commented out - run manually after migration)
-- Confirm columns are gone and active fields still exist
-- =====================================================

/*
-- Verify business_operations kept the right fields
SELECT 
  seating_capacity_indoor,
  seating_capacity_outdoor,
  price_level  -- LIVE DATA - must still exist
FROM business_operations 
LIMIT 1;
-- Should return: indoor, outdoor, price_level columns exist

-- Verify business_profile kept the right fields
SELECT 
  target_audience,
  menu_structure
FROM business_profile 
LIMIT 1;
-- Should return: target_audience, menu_structure exist

-- Verify business_locations still has postal_code (primary source)
SELECT postal_code FROM business_locations LIMIT 1;
-- Should return: postal_code column exists (THIS is the live one)

-- Verify businesses table structure
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_name = 'businesses' 
  AND column_name = 'postal_code';
-- Should return: 0 rows (column dropped)

-- Verify city_context_cache table structure
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_name = 'city_context_cache' 
  AND column_name = 'postal_code';
-- Should return: 0 rows (column dropped)
*/

-- =====================================================
-- ROLLBACK PLAN (if needed)
-- =====================================================

/*
-- If you need to rollback this migration:

-- Restore business_operations fields
ALTER TABLE business_operations
  ADD COLUMN typical_busy_periods TEXT,
  ADD COLUMN typical_slow_periods TEXT,
  ADD COLUMN average_check_per_person NUMERIC;

-- Restore business_profile fields
ALTER TABLE business_profile
  ADD COLUMN price_level TEXT,
  ADD COLUMN ai_brand_context TEXT,
  ADD COLUMN ai_brand_context_generated_at TIMESTAMP WITH TIME ZONE;

-- Restore businesses postal_code
ALTER TABLE businesses
  ADD COLUMN postal_code TEXT;

-- Restore city_context_cache postal_code
ALTER TABLE city_context_cache
  ADD COLUMN postal_code TEXT;
*/

-- =====================================================
-- MIGRATION COMPLETE
-- 8 empty fields dropped successfully
-- Code pollution reduced, NULL checks eliminated
-- =====================================================
