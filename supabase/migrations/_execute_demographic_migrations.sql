-- Combined Migration: Add demographic_proximity and migrate data
-- This file combines migrations 20260522000001 and 20260522000002
-- Execute this manually in Supabase SQL Editor

-- PART 1: Add new columns (from 20260522000001)
-- =====================================================

-- Add demographic_proximity column (JSONB to store WHO is nearby)
ALTER TABLE business_location_intelligence
  ADD COLUMN IF NOT EXISTS demographic_proximity JSONB DEFAULT '{}'::jsonb;

-- Add location_architecture_version to track migration state
ALTER TABLE business_location_intelligence
  ADD COLUMN IF NOT EXISTS location_architecture_version INT DEFAULT 1;

-- Add index for demographic_proximity queries
CREATE INDEX IF NOT EXISTS idx_location_demographic_proximity 
  ON business_location_intelligence USING GIN (demographic_proximity);

-- Add comment for documentation
COMMENT ON COLUMN business_location_intelligence.demographic_proximity IS 
  'JSONB storing demographic proximity data (WHO is nearby): university_proximity, tourist_flow, office_worker_density, residential_density. Separated from geographic location types (WHERE business is).';

COMMENT ON COLUMN business_location_intelligence.location_architecture_version IS 
  'Version 1: student/tourist in category_scores (old). Version 2: demographics in demographic_proximity (new architecture).';

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'Migration 001 completed: Added demographic_proximity and location_architecture_version columns';
END $$;


-- PART 2: Migrate existing data (from 20260522000002)
-- =====================================================

-- STEP 1: Create backup table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business_location_intelligence_backup_20260522') THEN
    EXECUTE 'CREATE TABLE business_location_intelligence_backup_20260522 AS SELECT * FROM business_location_intelligence';
    RAISE NOTICE 'Backup created: business_location_intelligence_backup_20260522';
  ELSE
    RAISE NOTICE 'Backup already exists, skipping creation';
  END IF;
END $$;

-- STEP 2: Migrate data from category_scores to demographic_proximity
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

-- STEP 3: Remove student and tourist from category_scores
UPDATE business_location_intelligence
SET 
  category_scores = category_scores - 'student' - 'tourist'
WHERE location_architecture_version = 2
  AND (category_scores ? 'student' OR category_scores ? 'tourist');

-- STEP 4: Remove student and tourist from concept_fit_by_category
UPDATE business_location_intelligence
SET 
  concept_fit_by_category = concept_fit_by_category - 'student' - 'tourist'
WHERE location_architecture_version = 2
  AND (concept_fit_by_category ? 'student' OR concept_fit_by_category ? 'tourist');

-- STEP 5: Verification query
DO $$
DECLARE
  total_count INT;
  migrated_count INT;
  has_student_in_category INT;
  has_tourist_in_category INT;
  demo_count INT;
BEGIN
  SELECT COUNT(*) INTO total_count FROM business_location_intelligence;
  SELECT COUNT(*) INTO migrated_count FROM business_location_intelligence WHERE location_architecture_version = 2;
  SELECT COUNT(*) INTO has_student_in_category FROM business_location_intelligence WHERE category_scores ? 'student';
  SELECT COUNT(*) INTO has_tourist_in_category FROM business_location_intelligence WHERE category_scores ? 'tourist';
  SELECT COUNT(*) INTO demo_count FROM business_location_intelligence WHERE demographic_proximity != '{}'::jsonb;
  
  RAISE NOTICE '════════════════════════════════════════════════';
  RAISE NOTICE 'Migration Results:';
  RAISE NOTICE '  Total records: %', total_count;
  RAISE NOTICE '  Migrated to v2: %', migrated_count;
  RAISE NOTICE '  With demographic_proximity data: %', demo_count;
  RAISE NOTICE '  Still have student in category_scores: %', has_student_in_category;
  RAISE NOTICE '  Still have tourist in category_scores: %', has_tourist_in_category;
  RAISE NOTICE '════════════════════════════════════════════════';
  
  IF has_student_in_category > 0 OR has_tourist_in_category > 0 THEN
    RAISE WARNING 'Some records still have student/tourist in category_scores!';
  ELSE
    RAISE NOTICE '✅ Migration completed successfully - all student/tourist data migrated to demographic_proximity';
  END IF;
END $$;

-- STEP 6: Show sample migrated data
SELECT 
  business_id,
  'category_scores' as field,
  jsonb_pretty(category_scores) as geographic_types,
  'demographic_proximity' as field2,
  jsonb_pretty(demographic_proximity) as demographics
FROM business_location_intelligence
WHERE demographic_proximity != '{}'::jsonb
LIMIT 3;
