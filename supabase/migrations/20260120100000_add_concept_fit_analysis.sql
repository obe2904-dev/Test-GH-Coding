-- Add Concept Fit Analysis to business_location_intelligence
-- This bridges location type with business operations to provide positioning guidance

ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS concept_fit_level TEXT CHECK (concept_fit_level IN ('strong', 'moderate', 'challenging')),
ADD COLUMN IF NOT EXISTS concept_fit_reasons JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS marketing_implications JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS timing_tweaks JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS suggested_adjustments JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS concept_fit_analyzed_at TIMESTAMP WITH TIME ZONE;

-- Comments for documentation
COMMENT ON COLUMN business_location_intelligence.concept_fit_level IS 'How well the business concept fits the location: strong, moderate, or challenging';
COMMENT ON COLUMN business_location_intelligence.concept_fit_reasons IS 'Array of 2-4 simple reasons explaining the fit level';
COMMENT ON COLUMN business_location_intelligence.marketing_implications IS 'Object with positioning guidance: {angle: string, cta_style: string, content_pillars: string[]}';
COMMENT ON COLUMN business_location_intelligence.timing_tweaks IS 'Array of timing suggestions based on area rhythm vs opening hours';
COMMENT ON COLUMN business_location_intelligence.suggested_adjustments IS 'Optional array of operational/menu adjustments to improve fit';

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'business_location_intelligence' 
AND column_name LIKE '%concept%';
