-- Migration: Move Student and Tourist Data to Demographic Proximity
-- Date: 2026-05-22
-- Purpose: Migrate existing student/tourist scores from category_scores to demographic_proximity

-- STEP 1: Create backup table
DO $$
BEGIN
  -- Only create backup if it doesn't exist
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
BEGIN
  SELECT COUNT(*) INTO total_count FROM business_location_intelligence;
  SELECT COUNT(*) INTO migrated_count FROM business_location_intelligence WHERE location_architecture_version = 2;
  SELECT COUNT(*) INTO has_student_in_category FROM business_location_intelligence WHERE category_scores ? 'student';
  SELECT COUNT(*) INTO has_tourist_in_category FROM business_location_intelligence WHERE category_scores ? 'tourist';
  
  RAISE NOTICE 'Migration Results:';
  RAISE NOTICE '  Total records: %', total_count;
  RAISE NOTICE '  Migrated to v2: %', migrated_count;
  RAISE NOTICE '  Still have student in category_scores: %', has_student_in_category;
  RAISE NOTICE '  Still have tourist in category_scores: %', has_tourist_in_category;
  
  IF has_student_in_category > 0 OR has_tourist_in_category > 0 THEN
    RAISE WARNING 'Some records still have student/tourist in category_scores!';
  ELSE
    RAISE NOTICE 'Migration 20260522000002 completed successfully - all student/tourist data migrated';
  END IF;
END $$;

-- STEP 6: Show sample migrated data
SELECT 
  business_id,
  'BEFORE (category_scores)' as label,
  jsonb_pretty((SELECT category_scores FROM business_location_intelligence_backup_20260522 b WHERE b.business_id = bli.business_id)) as old_scores,
  'AFTER (category_scores)' as label2,
  jsonb_pretty(category_scores) as new_scores,
  'NEW (demographic_proximity)' as label3,
  jsonb_pretty(demographic_proximity) as demographics
FROM business_location_intelligence bli
WHERE demographic_proximity != '{}'::jsonb
LIMIT 3;
