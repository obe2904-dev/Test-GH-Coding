-- Add category_scores column to business_location_intelligence
-- This stores all location category matches with their scores from analysis
-- Format: { "city_centre": 85, "tourist": 72, "waterfront": 65 }

ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS category_scores JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN business_location_intelligence.category_scores IS 
  'AI-generated location category scores from multi-category analysis. ' ||
  'Format: {"category_id": score}, where score is 0-100. ' ||
  'Multiple categories can match a single location.';
