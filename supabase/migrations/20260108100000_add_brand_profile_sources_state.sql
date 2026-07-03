-- Brand Profile Sources State
-- Tracks content hashes for each source to detect changes and avoid unnecessary regenerations

CREATE TABLE IF NOT EXISTS public.brand_profile_sources_state (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Source hashes (SHA-256 of canonical JSON)
  business_snapshot_hash TEXT,
  business_snapshot_changed_at TIMESTAMPTZ,
  
  profile_hash TEXT,
  profile_changed_at TIMESTAMPTZ,
  
  website_hash TEXT,
  website_changed_at TIMESTAMPTZ,
  
  location_hash TEXT,
  location_changed_at TIMESTAMPTZ,
  
  images_hash TEXT,
  images_changed_at TIMESTAMPTZ,
  
  menu_hash TEXT,
  menu_changed_at TIMESTAMPTZ,
  
  -- Combined version hash (hash of all source hashes)
  version_hash TEXT NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_brand_profile_sources_state_version_hash
ON public.brand_profile_sources_state (version_hash);

-- RLS policies (inherit from businesses table)
ALTER TABLE public.brand_profile_sources_state ENABLE ROW LEVEL SECURITY;

-- Users can read their own business sources state
CREATE POLICY "Users can read own business sources state"
ON public.brand_profile_sources_state
FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT id FROM public.businesses
    WHERE owner_id = auth.uid()
  )
);

-- System can insert/update (edge functions use service role)
CREATE POLICY "System can manage sources state"
ON public.brand_profile_sources_state
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add version_hash to brand_profiles table
ALTER TABLE public.business_brand_profile
ADD COLUMN IF NOT EXISTS version_hash TEXT;

-- Add index for version_hash lookups
CREATE INDEX IF NOT EXISTS idx_business_brand_profile_version_hash
ON public.business_brand_profile (version_hash);

-- Comments
COMMENT ON TABLE public.brand_profile_sources_state IS 
'Tracks content hashes for Brand Profile source data. Used to detect changes and avoid unnecessary AI regenerations.';

COMMENT ON COLUMN public.brand_profile_sources_state.version_hash IS 
'Combined hash of all source hashes. Changes when any source changes.';

COMMENT ON COLUMN public.business_brand_profile.version_hash IS 
'Version hash at the time this Brand Profile was generated. Links to brand_profile_sources_state.';

-- Verification
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'brand_profile_sources_state'
  ) THEN
    RAISE NOTICE '✓ brand_profile_sources_state table created';
  ELSE
    RAISE WARNING '✗ Failed to create brand_profile_sources_state table';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_brand_profile' 
    AND column_name = 'version_hash'
  ) THEN
    RAISE NOTICE '✓ business_brand_profile.version_hash column added';
  ELSE
    RAISE WARNING '✗ Failed to add version_hash column';
  END IF;
END $$;
