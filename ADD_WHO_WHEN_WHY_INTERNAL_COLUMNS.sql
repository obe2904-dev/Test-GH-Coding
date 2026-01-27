-- RUN THIS IN SUPABASE SQL EDITOR
-- Add internal WHO/WHEN/WHY columns for AI use (with competitor names)

ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS who_analysis_internal JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS when_analysis_internal JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS why_analysis_internal JSONB DEFAULT '[]'::jsonb;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'business_location_intelligence' 
AND column_name LIKE '%_internal%';
