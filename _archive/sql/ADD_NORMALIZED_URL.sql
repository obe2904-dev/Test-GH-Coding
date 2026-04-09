-- =====================================================
-- ADD normalized_url COLUMN TO EXISTING businesses TABLE
-- Run this in Supabase SQL Editor
-- =====================================================

-- Add normalized_url column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'businesses' 
    AND column_name = 'normalized_url'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN normalized_url TEXT;
    
    -- Add unique constraint
    ALTER TABLE public.businesses ADD CONSTRAINT businesses_normalized_url_key UNIQUE (normalized_url);
    
    -- Create index for faster lookups
    CREATE INDEX idx_businesses_normalized_url ON public.businesses(normalized_url) WHERE normalized_url IS NOT NULL;
    
    RAISE NOTICE 'Added normalized_url column with unique constraint and index';
  ELSE
    RAISE NOTICE 'Column normalized_url already exists';
  END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'businesses' 
AND column_name = 'normalized_url';
