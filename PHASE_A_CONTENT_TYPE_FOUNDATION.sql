-- PHASE A: Content Type System Foundation
-- Run this in Supabase SQL Editor to add type system fields
-- NO BEHAVIOR CHANGES - just adds infrastructure

BEGIN;

-- 1. Add target_type_mix to business_brand_profile (business-level distribution)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_brand_profile' 
    AND column_name = 'target_type_mix'
  ) THEN
    ALTER TABLE business_brand_profile 
    ADD COLUMN target_type_mix JSONB DEFAULT '{
      "product": 0.35,
      "experience": 0.30,
      "occasion": 0.25,
      "retention": 0.10
    }'::jsonb;
    
    COMMENT ON COLUMN business_brand_profile.target_type_mix IS 
    'Target distribution of content types across all posts over time. Used for drift correction.';
  END IF;
END $$;

-- 2. Add booking/walk-in distinction to business_programme_profiles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_programme_profiles' 
    AND column_name = 'accepts_reservations'
  ) THEN
    ALTER TABLE business_programme_profiles
    ADD COLUMN accepts_reservations BOOLEAN DEFAULT true;
    
    COMMENT ON COLUMN business_programme_profiles.accepts_reservations IS 
    'Whether this programme accepts table reservations in addition to walk-ins.';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_programme_profiles' 
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE business_programme_profiles
    ADD COLUMN is_active BOOLEAN DEFAULT true;
    
    COMMENT ON COLUMN business_programme_profiles.is_active IS 
    'Whether this programme is currently active and should appear in content generation.';
  END IF;
END $$;

-- 3. Set default values for existing rows
UPDATE business_brand_profile 
SET target_type_mix = '{
  "product": 0.35,
  "experience": 0.30,
  "occasion": 0.25,
  "retention": 0.10
}'::jsonb
WHERE target_type_mix IS NULL;

UPDATE business_programme_profiles
SET accepts_reservations = CASE 
  WHEN decision_timing IN ('planned_reservation', 'planned') THEN true
  WHEN decision_timing IN ('spontaneous_walk_in', 'spontaneous') THEN true  -- bistros accept both
  ELSE true  -- default to accepting reservations
END
WHERE accepts_reservations IS NULL;

UPDATE business_programme_profiles
SET is_active = true
WHERE is_active IS NULL;

COMMIT;

-- Verification queries
SELECT 'business_brand_profile columns' as check_type, count(*) as count
FROM information_schema.columns 
WHERE table_name = 'business_brand_profile' 
AND column_name = 'target_type_mix';

SELECT 'business_programme_profiles columns' as check_type, count(*) as count
FROM information_schema.columns 
WHERE table_name = 'business_programme_profiles' 
AND column_name IN ('accepts_reservations', 'is_active');

SELECT 'Cafe Faust programmes' as check_type, 
  programme_type, 
  decision_timing,
  accepts_reservations,
  is_active
FROM business_programme_profiles
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a';
