-- Test file for Task 3.1 migration
-- This validates the hour range detection logic on sample data

-- Create test function (same as migration)
CREATE OR REPLACE FUNCTION get_programme_hour_range(programmes TEXT[])
RETURNS JSONB AS $$
DECLARE
  prog_str TEXT;
BEGIN
  prog_str := LOWER(ARRAY_TO_STRING(programmes, ' '));
  
  IF prog_str ~ '(brunch|morgenmad|breakfast|morgenkaffe)' THEN
    RETURN jsonb_build_object('start', 7, 'end', 12);
  ELSIF prog_str ~ '(frokost|lunch)' THEN
    RETURN jsonb_build_object('start', 11, 'end', 16);
  ELSIF prog_str ~ '(kaffe|kage|cake|eftermiddag)' THEN
    RETURN jsonb_build_object('start', 14, 'end', 18);
  ELSIF prog_str ~ '(aften|middag|dinner)' THEN
    RETURN jsonb_build_object('start', 17, 'end', 23);
  ELSIF prog_str ~ '(cocktail|bar|drink|nat)' THEN
    RETURN jsonb_build_object('start', 20, 'end', 3);
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Test cases
SELECT 
  'Brunch' AS test_case,
  get_programme_hour_range(ARRAY['Brunch']) AS result,
  jsonb_build_object('start', 7, 'end', 12) AS expected,
  get_programme_hour_range(ARRAY['Brunch']) = jsonb_build_object('start', 7, 'end', 12) AS matches
UNION ALL
SELECT 
  'Frokost',
  get_programme_hour_range(ARRAY['Frokost']),
  jsonb_build_object('start', 11, 'end', 16),
  get_programme_hour_range(ARRAY['Frokost']) = jsonb_build_object('start', 11, 'end', 16)
UNION ALL
SELECT 
  'Aftensmad',
  get_programme_hour_range(ARRAY['Aftensmad']),
  jsonb_build_object('start', 17, 'end', 23),
  get_programme_hour_range(ARRAY['Aftensmad']) = jsonb_build_object('start', 17, 'end', 23)
UNION ALL
SELECT 
  'Cocktails',
  get_programme_hour_range(ARRAY['Cocktails']),
  jsonb_build_object('start', 20, 'end', 3),
  get_programme_hour_range(ARRAY['Cocktails']) = jsonb_build_object('start', 20, 'end', 3)
UNION ALL
SELECT 
  'Eftermiddagskaffe',
  get_programme_hour_range(ARRAY['Eftermiddagskaffe']),
  jsonb_build_object('start', 14, 'end', 18),
  get_programme_hour_range(ARRAY['Eftermiddagskaffe']) = jsonb_build_object('start', 14, 'end', 18)
UNION ALL
SELECT 
  'Multiple: Brunch, Morgenkaffe',
  get_programme_hour_range(ARRAY['Brunch', 'Morgenkaffe']),
  jsonb_build_object('start', 7, 'end', 12),
  get_programme_hour_range(ARRAY['Brunch', 'Morgenkaffe']) = jsonb_build_object('start', 7, 'end', 12)
UNION ALL
SELECT 
  'Unknown programme',
  get_programme_hour_range(ARRAY['Unknown']),
  NULL,
  get_programme_hour_range(ARRAY['Unknown']) IS NULL;

-- Expected output:
-- All rows should have matches = true

-- Clean up
DROP FUNCTION IF EXISTS get_programme_hour_range(TEXT[]);
