-- ═══════════════════════════════════════════════════════════════════════════
-- DEPLOYMENT: Flatten Strategic Audience Segments
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor

-- 1. Add column
ALTER TABLE business_brand_profile
  ADD COLUMN IF NOT EXISTS strategic_audience_segments JSONB DEFAULT NULL;

-- 2. Add GIN index
CREATE INDEX IF NOT EXISTS idx_strategic_audience_segments 
  ON business_brand_profile USING GIN (strategic_audience_segments);

-- 3. Migrate existing data
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

-- 4. Add validation
ALTER TABLE business_brand_profile
  ADD CONSTRAINT check_strategic_audience_segments_is_object 
  CHECK (
    strategic_audience_segments IS NULL 
    OR jsonb_typeof(strategic_audience_segments) = 'object'
  );

-- 5. Verify
SELECT 
  COUNT(*) FILTER (WHERE strategic_audience_segments IS NOT NULL) as with_segments,
  COUNT(*) FILTER (WHERE strategic_audience_segments->'primary' IS NOT NULL) as with_primary,
  COUNT(*) FILTER (WHERE strategic_audience_segments->'secondary' IS NOT NULL 
    AND jsonb_array_length(strategic_audience_segments->'secondary') > 0) as with_secondary,
  COUNT(*) as total
FROM business_brand_profile;

-- 6. Sample data
SELECT 
  business_id,
  strategic_audience_segments->'primary'->>'name' as primary_segment,
  jsonb_array_length(COALESCE(strategic_audience_segments->'secondary', '[]'::jsonb)) as secondary_count,
  strategic_audience_segments
FROM business_brand_profile
WHERE strategic_audience_segments IS NOT NULL
LIMIT 3;
