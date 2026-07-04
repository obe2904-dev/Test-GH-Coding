-- Add menu_signal column to business_profile for AI-extracted menu overview
-- This supplements the full menu extraction system (menu_extractions table)
-- Used by Free tier and as quick preview for Paid tier

-- Add menu_signal column (JSONB for flexible structure)
ALTER TABLE business_profile
ADD COLUMN IF NOT EXISTS menu_signal JSONB;

-- Add index for performance (JSON queries can be slow)
CREATE INDEX IF NOT EXISTS idx_business_profile_menu_signal 
ON business_profile USING GIN (menu_signal);

-- Add comment for documentation
COMMENT ON COLUMN business_profile.menu_signal IS 'AI-extracted menu signal from website analysis (Free+Paid tiers). Structure: {hasMenu, menuDescription, menuCategories, signatureItems, rawExtract}';

-- Note: tone_of_voice already exists in business_brand_profile as TEXT
-- Document mentions JSONB but we keep TEXT for backwards compatibility
-- If needed in future, can migrate: ALTER TABLE business_brand_profile ALTER COLUMN tone_of_voice TYPE JSONB USING tone_of_voice::jsonb;

-- Verify column was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'business_profile' 
      AND column_name = 'menu_signal'
  ) THEN
    RAISE NOTICE '✅ Column menu_signal added successfully to business_profile';
  ELSE
    RAISE WARNING '❌ Failed to add menu_signal column';
  END IF;
END $$;
