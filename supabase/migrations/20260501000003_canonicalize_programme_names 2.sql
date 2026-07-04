-- Task 3.2: Canonicalize Programme Names in audience_framework.timeSlots
-- 
-- Purpose: Normalize programme name variations (e.g., "Brunch", "Morgenmad", "Breakfast")
-- to prevent rotation tracking fragmentation.
-- 
-- Background: AI-extracted menu data produces inconsistent programme names across different
-- menu sources. This migration standardizes existing data to canonical forms.
--
-- Safe to run multiple times (idempotent).

-- Create canonicalization function that mirrors TypeScript logic
CREATE OR REPLACE FUNCTION canonicalize_programme(programme_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT;
BEGIN
  -- Normalize to lowercase and trim
  normalized := LOWER(TRIM(programme_name));
  
  -- Brunch / Morning variations → 'brunch'
  IF normalized IN ('brunch', 'morgenmad', 'breakfast', 'morgenkaffe', 'morgenmenu', 'morning') THEN
    RETURN 'brunch';
  
  -- Lunch variations → 'frokost'
  ELSIF normalized IN ('frokost', 'lunch', 'lunsj', 'middagsmad') THEN
    RETURN 'frokost';
  
  -- Dinner variations → 'aftensmad'
  ELSIF normalized IN ('aftensmad', 'dinner', 'middag', 'aftenmenu', 'evening') THEN
    RETURN 'aftensmad';
  
  -- Bar / Drinks variations → 'cocktails'
  ELSIF normalized IN ('cocktails', 'bar', 'drinks', 'natmenu', 'nightlife', 'aften bar') THEN
    RETURN 'cocktails';
  
  -- Dessert / Sweet variations → 'dessert'
  ELSIF normalized IN ('dessert', 'kage', 'cake', 'kaffe & kage', 'eftermiddagskaffe') THEN
    RETURN 'dessert';
  
  -- No mapping found - return normalized form
  ELSE
    RETURN normalized;
  END IF;
END;
$$;

COMMENT ON FUNCTION canonicalize_programme IS 'Task 3.2: Normalize programme name variations to canonical forms (e.g., Morgenmad → brunch). Matches TypeScript canonicalizeProgramme() logic.';

-- Update existing audience_framework.timeSlots to canonicalize programme names
UPDATE business_brand_profile
SET audience_framework = jsonb_build_object(
    'timeSlots', (
      SELECT jsonb_agg(
        CASE 
          WHEN slot ? 'programmes' THEN
            jsonb_set(
              slot,
              '{programmes}',
              (
                -- Canonicalize each programme in the array and deduplicate
                SELECT jsonb_agg(DISTINCT canonical_prog ORDER BY canonical_prog)
                FROM (
                  SELECT canonicalize_programme(prog::TEXT) AS canonical_prog
                  FROM jsonb_array_elements_text(slot->'programmes') AS prog
                  WHERE prog::TEXT IS NOT NULL AND prog::TEXT != ''
                ) AS canonicalized
              )
            )
          ELSE
            slot
        END
      )
      FROM jsonb_array_elements(business_brand_profile.audience_framework->'timeSlots') AS slot
    ),
    'primaryAudiences', COALESCE(business_brand_profile.audience_framework->'primaryAudiences', '[]'::jsonb),
    'locationContexts', COALESCE(business_brand_profile.audience_framework->'locationContexts', '[]'::jsonb),
    'seasonalVariation', COALESCE(business_brand_profile.audience_framework->'seasonalVariation', 'null'::jsonb),
    'complexity', COALESCE(business_brand_profile.audience_framework->'complexity', 'null'::jsonb)
  )
WHERE 
  audience_framework IS NOT NULL 
  AND audience_framework->'timeSlots' IS NOT NULL
  AND jsonb_array_length(audience_framework->'timeSlots') > 0;

-- Log summary of changes
DO $$
DECLARE
  updated_count INT;
  total_with_framework INT;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM business_brand_profile
  WHERE audience_framework->'timeSlots' IS NOT NULL;
  
  SELECT COUNT(*) INTO total_with_framework
  FROM business_brand_profile
  WHERE audience_framework IS NOT NULL;
  
  RAISE NOTICE 'Task 3.2 Migration Complete:';
  RAISE NOTICE '  - % businesses with audience_framework', total_with_framework;
  RAISE NOTICE '  - % businesses with timeSlots updated', updated_count;
  RAISE NOTICE '  - Programme names canonicalized to: brunch, frokost, aftensmad, cocktails, dessert';
END $$;
