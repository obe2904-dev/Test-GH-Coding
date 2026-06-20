-- ============================================================================
-- FIX: Add demographic_proximity column and refresh schema cache
-- Execute this in Supabase Dashboard > SQL Editor
-- ============================================================================
-- This fixes the error: "Could not find the 'demographic_proximity' column"
-- Date: 2026-06-19
-- ============================================================================

-- STEP 1: Add the missing columns (safe if already exists)
ALTER TABLE business_location_intelligence
  ADD COLUMN IF NOT EXISTS demographic_proximity JSONB DEFAULT '{}'::jsonb;

ALTER TABLE business_location_intelligence
  ADD COLUMN IF NOT EXISTS location_architecture_version INT DEFAULT 1;

-- STEP 2: Add index for demographic proximity queries
CREATE INDEX IF NOT EXISTS idx_location_demographic_proximity 
  ON business_location_intelligence USING GIN (demographic_proximity);

-- STEP 3: Add column documentation
COMMENT ON COLUMN business_location_intelligence.demographic_proximity IS 
  'JSONB storing demographic proximity data (WHO is nearby): university_proximity, tourist_flow, office_worker_density, residential_density.';

COMMENT ON COLUMN business_location_intelligence.location_architecture_version IS 
  'Version 1: student/tourist in category_scores (old). Version 2: demographics in demographic_proximity (new architecture).';

-- STEP 4: Migrate existing data from category_scores to demographic_proximity
UPDATE business_location_intelligence
SET 
  demographic_proximity = jsonb_build_object(
    'university_proximity', COALESCE((category_scores->>'student')::int, 0),
    'tourist_flow', COALESCE((category_scores->>'tourist')::int, 0),
    'office_worker_density', COALESCE((category_scores->>'office')::int, 0),
    'residential_density', COALESCE((category_scores->>'residential')::int, 0)
  ),
  location_architecture_version = 2
WHERE location_architecture_version = 1 OR location_architecture_version IS NULL;

-- STEP 5: Clean up old student/tourist data from category_scores
UPDATE business_location_intelligence
SET 
  category_scores = category_scores - 'student' - 'tourist'
WHERE location_architecture_version = 2
  AND (category_scores ? 'student' OR category_scores ? 'tourist');

-- STEP 6: CRITICAL - Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- STEP 7: Verify the fix worked
SELECT 
  'Column exists: ' || CASE WHEN COUNT(*) > 0 THEN 'YES ✓' ELSE 'NO ✗' END as status
FROM information_schema.columns
WHERE table_name = 'business_location_intelligence' 
  AND column_name = 'demographic_proximity';

-- STEP 8: Show sample data to confirm migration
SELECT 
  business_id,
  jsonb_pretty(category_scores) as geographic_types,
  jsonb_pretty(demographic_proximity) as demographics,
  location_architecture_version
FROM business_location_intelligence
LIMIT 3;
