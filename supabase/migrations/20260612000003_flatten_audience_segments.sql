-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Flatten Strategic Audience Segments
-- ═══════════════════════════════════════════════════════════════════════════
-- Date: June 12, 2026
-- Purpose: Extract strategic audience segments (primary + secondary) from
--          verbose audience_segments JSONB for faster access and clearer personas
--
-- MOTIVATION:
-- - Current: audience_segments contains full verbose JSON with all metadata
-- - Problem: business_identity_persona uses generic location_intelligence scores
--            (e.g., "Students: 88 score") which aren't business-specific
-- - Solution: Extract only strategic segments (primary + secondary, skip niche)
--            for use in persona generation
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add dedicated column for strategic segments
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS strategic_audience_segments JSONB DEFAULT NULL;

-- 2. Add GIN index for fast JSONB queries
CREATE INDEX IF NOT EXISTS idx_strategic_audience_segments 
  ON business_brand_profile USING GIN (strategic_audience_segments);

-- 3. Migrate existing data: Extract primary + secondary segments from audience_segments
UPDATE business_brand_profile
SET strategic_audience_segments = (
  SELECT jsonb_build_object(
    'primary', (
      SELECT jsonb_build_object(
        'id', seg->>'id',
        'name', seg->>'name',
        'timing', (
          CASE 
            WHEN seg->'timing' IS NOT NULL AND jsonb_array_length(seg->'timing') > 0 THEN
              CONCAT(
                seg->'timing'->0->>'day',
                ' ',
                seg->'timing'->0->>'hour_start',
                '-',
                seg->'timing'->0->>'hour_end'
              )
            ELSE NULL
          END
        )
      )
      FROM jsonb_array_elements(audience_segments->'segments') AS seg
      WHERE seg->>'priority' = 'primary'
      LIMIT 1
    ),
    'secondary', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', seg->>'id',
          'name', seg->>'name',
          'timing', (
            CASE 
              WHEN seg->'timing' IS NOT NULL AND jsonb_array_length(seg->'timing') > 0 THEN
                CONCAT(
                  seg->'timing'->0->>'day',
                  ' ',
                  seg->'timing'->0->>'hour_start',
                  '-',
                  seg->'timing'->0->>'hour_end'
                )
              ELSE NULL
            END
          )
        )
      )
      FROM jsonb_array_elements(audience_segments->'segments') AS seg
      WHERE seg->>'priority' = 'secondary'
    )
  )
)
WHERE audience_segments IS NOT NULL
  AND audience_segments->'segments' IS NOT NULL
  AND jsonb_array_length(audience_segments->'segments') > 0;

-- 4. Add helpful comments
COMMENT ON COLUMN business_brand_profile.strategic_audience_segments IS 
  'Strategic audience segments extracted from audience_segments for persona generation.
   
   Structure: Compact object with primary and secondary segments only (niche excluded)
   {
     "primary": {
       "id": "aftensmad_ved_aaen",
       "name": "Aftensmad ved åen",
       "timing": "weekday 18-22"
     },
     "secondary": [
       {
         "id": "brunchentusiaster",
         "name": "Brunchentusiaster",
         "timing": "weekend 10-14"
       },
       {
         "id": "frokostpauser",
         "name": "Frokostpauser",
         "timing": "weekday 12-14"
       }
     ]
   }
   
   Used by: business-identity-persona.ts for targeted persona generation
   Benefits: Business-specific (not generic location data), strategic priority-based
   Migrated from: audience_segments.segments filtered by priority';

-- 5. Add validation constraint
ALTER TABLE business_brand_profile
  ADD CONSTRAINT check_strategic_audience_segments_is_object 
  CHECK (
    strategic_audience_segments IS NULL 
    OR jsonb_typeof(strategic_audience_segments) = 'object'
  );

-- 6. Verification queries
DO $$
DECLARE
  total_records INTEGER;
  with_segments INTEGER;
  with_primary INTEGER;
  with_secondary INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_records
  FROM business_brand_profile;
  
  SELECT COUNT(*) INTO with_segments
  FROM business_brand_profile
  WHERE strategic_audience_segments IS NOT NULL;
  
  SELECT COUNT(*) INTO with_primary
  FROM business_brand_profile
  WHERE strategic_audience_segments->'primary' IS NOT NULL;
  
  SELECT COUNT(*) INTO with_secondary
  FROM business_brand_profile
  WHERE strategic_audience_segments->'secondary' IS NOT NULL
    AND jsonb_array_length(strategic_audience_segments->'secondary') > 0;
  
  RAISE NOTICE '✅ Migration complete:';
  RAISE NOTICE '   - Total brand profiles: %', total_records;
  RAISE NOTICE '   - With strategic segments: %', with_segments;
  RAISE NOTICE '   - With primary segment: %', with_primary;
  RAISE NOTICE '   - With secondary segments: %', with_secondary;
END $$;

-- 7. Show sample data
SELECT 
  business_id,
  strategic_audience_segments->'primary'->>'name' as primary_segment,
  jsonb_array_length(COALESCE(strategic_audience_segments->'secondary', '[]'::jsonb)) as secondary_count,
  strategic_audience_segments
FROM business_brand_profile
WHERE strategic_audience_segments IS NOT NULL
LIMIT 3;
