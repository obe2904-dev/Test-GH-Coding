-- Task 3.1: Add Hour Ranges to audience_framework.timeSlots
-- This migration backfills hourRange for existing timeSlots based on programme names
-- Enables business-specific service hours while maintaining backward compatibility

-- Create a temporary function to determine hour range based on programme names
CREATE OR REPLACE FUNCTION get_programme_hour_range(programmes TEXT[])
RETURNS JSONB AS $$
DECLARE
  prog_str TEXT;
BEGIN
  -- Join programme names and convert to lowercase for pattern matching
  prog_str := LOWER(ARRAY_TO_STRING(programmes, ' '));
  
  -- Match against known programme patterns (same logic as TypeScript getProgrammeHourRange)
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
    -- No match - return null (hourRange remains optional)
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing audience_framework.timeSlots to add hourRange
UPDATE business_brand_profile
SET audience_framework = (
  SELECT jsonb_set(
    audience_framework,
    '{timeSlots}',
    (
      SELECT jsonb_agg(
        CASE 
          -- Only add hourRange if:
          -- 1. timeSlot doesn't already have hourRange
          -- 2. We can determine a range from programmes
          WHEN slot->>'hourRange' IS NULL AND 
               get_programme_hour_range(
                 ARRAY(SELECT jsonb_array_elements_text(slot->'programmes'))
               ) IS NOT NULL
          THEN slot || jsonb_build_object(
            'hourRange', 
            get_programme_hour_range(
              ARRAY(SELECT jsonb_array_elements_text(slot->'programmes'))
            )
          )
          ELSE slot
        END
      )
      FROM jsonb_array_elements(audience_framework->'timeSlots') AS slot
    )
  )
  FROM business_brand_profile AS bp
  WHERE bp.business_id = business_brand_profile.business_id
)
WHERE 
  audience_framework IS NOT NULL 
  AND audience_framework->'timeSlots' IS NOT NULL
  AND jsonb_array_length(audience_framework->'timeSlots') > 0;

-- Update column comment to reflect new optional field
COMMENT ON COLUMN business_brand_profile.audience_framework IS 
'Multi-dimensional audience framework with location contexts, time slots, and seasonal variations. 
Structure: { 
  primaryAudiences: string[], 
  locationContexts: [{type, score, audiences, seasonal}], 
  timeSlots: [{
    label?: string,
    programmes: string[], 
    audiences: string[], 
    contexts?: string[],
    hourRange?: {start: number, end: number},  -- NEW (Task 3.1): Explicit hour ranges
    dayExclusions?: string[]  -- NEW (Task 4.4): Day exclusions
  }], 
  seasonalVariation?: {summer, winter}, 
  complexity?: string 
}';

-- Clean up temporary function
DROP FUNCTION IF EXISTS get_programme_hour_range(TEXT[]);

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Task 3.1 migration complete: hourRange backfilled for existing timeSlots';
  RAISE NOTICE 'Code already supports hourRange with fallback to programme name matching';
  RAISE NOTICE 'See supabase/functions/_shared/persona-matcher.ts for implementation';
END $$;
