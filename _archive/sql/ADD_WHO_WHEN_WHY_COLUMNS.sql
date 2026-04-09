-- Add WHO/WHEN/WHY columns to business_location_intelligence table
-- This stores AI-generated target audience, time patterns, and positioning analysis

ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS who_analysis JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS when_analysis JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS why_analysis JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS assumptions_to_review JSONB DEFAULT '[]'::jsonb;

-- Add comment to describe the columns
COMMENT ON COLUMN business_location_intelligence.who_analysis IS 'Target audience segments with intent and confidence levels';
COMMENT ON COLUMN business_location_intelligence.when_analysis IS 'Time patterns describing when different customers visit';
COMMENT ON COLUMN business_location_intelligence.why_analysis IS 'Positioning angles and value propositions';
COMMENT ON COLUMN business_location_intelligence.assumptions_to_review IS 'AI assumptions that need human review';
