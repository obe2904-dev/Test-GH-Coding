-- ============================================================================
-- ADD LOCAL_LOCATION_REFERENCE TO BUSINESSES TABLE
-- ============================================================================
-- User-editable field for authentic local place names
-- Optional field - NULL if business has no distinctive landmark
-- Examples: "ved åen", "Nyhavn", "i Vesterbro", "ved stranden"
-- ============================================================================

-- Add column to businesses table (source of truth)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS local_location_reference TEXT;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- TEST DATA: Set for Cafe Faust
-- ============================================================================

-- Set Cafe Faust's local reference (from their website: "ved åen i Aarhus")
UPDATE businesses
SET local_location_reference = 'ved åen'
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify column exists
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'businesses'
  AND column_name = 'local_location_reference';

-- Verify Cafe Faust has the value
SELECT 
  id,
  name,
  local_location_reference
FROM businesses
WHERE id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
