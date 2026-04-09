-- RUN THIS IN SUPABASE SQL EDITOR
-- This adds AI Brand Context columns to business_profile table

-- Add columns if they don't exist
DO $$ 
BEGIN
  -- Add ai_brand_context column
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_profile'
    AND column_name = 'ai_brand_context'
  ) THEN
    ALTER TABLE public.business_profile
    ADD COLUMN ai_brand_context TEXT;
    
    RAISE NOTICE 'Added ai_brand_context column';
  ELSE
    RAISE NOTICE 'ai_brand_context column already exists';
  END IF;

  -- Add ai_brand_context_generated_at column
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_profile'
    AND column_name = 'ai_brand_context_generated_at'
  ) THEN
    ALTER TABLE public.business_profile
    ADD COLUMN ai_brand_context_generated_at TIMESTAMPTZ;
    
    RAISE NOTICE 'Added ai_brand_context_generated_at column';
  ELSE
    RAISE NOTICE 'ai_brand_context_generated_at column already exists';
  END IF;

  -- Add ai_brand_context_approved column
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_profile'
    AND column_name = 'ai_brand_context_approved'
  ) THEN
    ALTER TABLE public.business_profile
    ADD COLUMN ai_brand_context_approved BOOLEAN DEFAULT false;
    
    RAISE NOTICE 'Added ai_brand_context_approved column';
  ELSE
    RAISE NOTICE 'ai_brand_context_approved column already exists';
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN public.business_profile.ai_brand_context IS 
  'AI-generated brand context prompt used for content creation';

COMMENT ON COLUMN public.business_profile.ai_brand_context_generated_at IS 
  'Timestamp when the brand context was last generated';

COMMENT ON COLUMN public.business_profile.ai_brand_context_approved IS 
  'Whether the user has reviewed and approved the brand context';

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_business_profile_brand_context_generated 
  ON public.business_profile(ai_brand_context_generated_at) 
  WHERE ai_brand_context IS NOT NULL;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'business_profile'
AND column_name LIKE 'ai_brand_context%'
ORDER BY ordinal_position;
