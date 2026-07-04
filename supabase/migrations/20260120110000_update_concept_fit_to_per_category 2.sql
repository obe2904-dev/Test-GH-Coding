-- Update Concept Fit to be per-category instead of single assessment
-- Each detected location category (with score >= 60%) gets its own fit analysis

-- Drop old single-category columns
ALTER TABLE business_location_intelligence
DROP COLUMN IF EXISTS concept_fit_level,
DROP COLUMN IF EXISTS concept_fit_reasons,
DROP COLUMN IF EXISTS marketing_implications,
DROP COLUMN IF EXISTS timing_tweaks,
DROP COLUMN IF EXISTS suggested_adjustments;

-- Add new per-category fit column
ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS concept_fit_by_category JSONB DEFAULT '{}'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN business_location_intelligence.concept_fit_by_category IS 'Concept fit analysis for each detected location category. Keyed by category_id, contains fit_level, one_liner, marketing_angle, etc.';

-- Keep the timestamp column
-- concept_fit_analyzed_at already exists

-- Verify column structure
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'business_location_intelligence' 
AND column_name LIKE '%concept%';
