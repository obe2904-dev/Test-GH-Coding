-- Migration: Add quality_status to business_brand_profile
-- Tracks AI generation quality for UI indicators and re-generation triggers

-- Add quality_status column
ALTER TABLE public.business_brand_profile
ADD COLUMN IF NOT EXISTS quality_status TEXT CHECK (quality_status IN ('green', 'yellow', 'red')) DEFAULT 'green';

-- Add generation_errors JSONB column to store error details
ALTER TABLE public.business_brand_profile
ADD COLUMN IF NOT EXISTS generation_errors JSONB DEFAULT '[]'::jsonb;

-- Add index for filtering by quality status
CREATE INDEX IF NOT EXISTS idx_business_brand_profile_quality_status
ON public.business_brand_profile (quality_status);

-- Add comments
COMMENT ON COLUMN public.business_brand_profile.quality_status IS 'Generation quality: green (perfect), yellow (medium issues only), red (critical/high issues)';
COMMENT ON COLUMN public.business_brand_profile.generation_errors IS 'Detailed error log from generation (category, severity, message, phase)';

-- Migration verification
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_brand_profile' 
    AND column_name = 'quality_status'
  ) THEN
    RAISE NOTICE '✓ business_brand_profile.quality_status column created';
  ELSE
    RAISE WARNING '✗ business_brand_profile.quality_status column NOT found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_brand_profile' 
    AND column_name = 'generation_errors'
  ) THEN
    RAISE NOTICE '✓ business_brand_profile.generation_errors column created';
  ELSE
    RAISE WARNING '✗ business_brand_profile.generation_errors column NOT found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'business_brand_profile' 
    AND indexname = 'idx_business_brand_profile_quality_status'
  ) THEN
    RAISE NOTICE '✓ idx_business_brand_profile_quality_status index created';
  ELSE
    RAISE WARNING '✗ idx_business_brand_profile_quality_status index NOT found';
  END IF;
END $$;
