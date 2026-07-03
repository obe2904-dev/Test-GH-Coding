-- RUN THIS IN SUPABASE SQL EDITOR
-- Dashboard → SQL Editor → New Query → Paste this → Run

-- Add category_scores column to business_location_intelligence
ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS category_scores JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN business_location_intelligence.category_scores IS 
  'AI-generated location category scores from multi-category analysis. Format: {"category_id": score}, where score is 0-100. Multiple categories can match a single location.';

-- Verify column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'business_location_intelligence'
AND column_name = 'category_scores';
