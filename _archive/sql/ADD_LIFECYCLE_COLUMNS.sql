-- Add lifecycle tracking columns to business_brand_profile table
-- These columns enable preservation of user edits per LIFECYCLE_RULES.md

-- Add last_edited_by column to track whether AI or user made the last edit
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS last_edited_by TEXT DEFAULT 'ai';

-- Add last_edited_at column to track when the last edit occurred
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP DEFAULT NOW();

-- Add comments to document the lifecycle tracking system
COMMENT ON COLUMN business_brand_profile.last_edited_by IS 'Tracks edit source: "ai" for AI-generated content, "user" for manual edits - used to prevent overwriting user changes';
COMMENT ON COLUMN business_brand_profile.last_edited_at IS 'Timestamp of last edit - used for lifecycle rules and regeneration logic';

-- Verify columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'business_brand_profile'
  AND column_name IN ('last_edited_by', 'last_edited_at')
ORDER BY column_name;
