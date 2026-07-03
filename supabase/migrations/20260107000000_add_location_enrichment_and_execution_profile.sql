-- Migration: Add location enrichment and execution profile columns
-- Part of Phase 1: Location Enrichment + Execution Profile architecture
-- Adds structured JSONB storage for location context and AI-optimized brand profile

-- ===============================
-- 1. Location Enrichment Storage
-- ===============================
-- Add enrichment column to business_locations
-- Stores LocationEnrichment type: { geo?, macro, micro, version }
ALTER TABLE public.business_locations
ADD COLUMN IF NOT EXISTS enrichment JSONB;

-- Add GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_business_locations_enrichment
ON public.business_locations USING GIN (enrichment);

-- Document the column
COMMENT ON COLUMN public.business_locations.enrichment IS 'Location enrichment data: macro context (country/region/city/city_tier), micro context (area_type/nearby_signals), and geo coordinates';

-- ===============================
-- 2. Execution Profile Storage
-- ===============================
-- Add execution_profile column to business_brand_profile
-- Stores ExecutionProfile type: AI-optimized, structured brand profile
ALTER TABLE public.business_brand_profile
ADD COLUMN IF NOT EXISTS execution_profile JSONB;

-- Add GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_business_brand_profile_execution_profile
ON public.business_brand_profile USING GIN (execution_profile);

-- Document the column
COMMENT ON COLUMN public.business_brand_profile.execution_profile IS 'AI-optimized execution profile: structured brand data for post-idea generation (locale_context, micro_location_context, usage_occasions, offerings_allowlist, cta_policy, forbidden_terms, photo_rules)';

-- ===============================
-- Validation Queries (for testing)
-- ===============================
-- Verify columns were added
DO $$
BEGIN
  -- Check enrichment column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_locations' 
    AND column_name = 'enrichment'
  ) THEN
    RAISE NOTICE '✓ business_locations.enrichment column created';
  ELSE
    RAISE WARNING '✗ business_locations.enrichment column NOT found';
  END IF;

  -- Check execution_profile column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'business_brand_profile' 
    AND column_name = 'execution_profile'
  ) THEN
    RAISE NOTICE '✓ business_brand_profile.execution_profile column created';
  ELSE
    RAISE WARNING '✗ business_brand_profile.execution_profile column NOT found';
  END IF;

  -- Check indexes
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'business_locations' 
    AND indexname = 'idx_business_locations_enrichment'
  ) THEN
    RAISE NOTICE '✓ idx_business_locations_enrichment index created';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'business_brand_profile' 
    AND indexname = 'idx_business_brand_profile_execution_profile'
  ) THEN
    RAISE NOTICE '✓ idx_business_brand_profile_execution_profile index created';
  END IF;
END $$;
