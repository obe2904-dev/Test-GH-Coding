-- Migration 014: Add menu_structure column to business_profile table
-- Stores the full structured menu data from AI extraction as JSON

-- Add menu_structure column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_profile'
    AND column_name = 'menu_structure'
  ) THEN
    ALTER TABLE public.business_profile
    ADD COLUMN menu_structure JSONB;
    
    RAISE NOTICE 'Added menu_structure column';
  ELSE
    RAISE NOTICE 'menu_structure column already exists';
  END IF;
END $$;

-- Add GIN index for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_business_profile_menu_structure 
ON public.business_profile USING GIN (menu_structure);

-- Update comment
COMMENT ON COLUMN public.business_profile.menu_structure IS 'Full structured menu data with categories, items, prices, and ingredients (JSON format)';
