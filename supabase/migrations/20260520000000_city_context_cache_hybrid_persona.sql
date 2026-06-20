-- ============================================================================
-- MIGRATION: City Context Cache for AI-Generated Geographic Intelligence
-- ============================================================================
-- Date: 2026-05-20
-- Purpose: Support HYBRID persona approach with AI-generated city contexts
-- Replaces: Hardcoded city lists in geographic-context.ts
-- ============================================================================

-- Create city_context_cache table
CREATE TABLE IF NOT EXISTS public.city_context_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Denmark',
  postal_code TEXT,
  
  -- AI-generated context
  population INTEGER,
  city_size TEXT NOT NULL CHECK (city_size IN ('small_town', 'medium_city', 'major_city', 'capital')),
  cultural_context TEXT NOT NULL, -- AI-generated brief context (20-30 words max)
  tone TEXT, -- Suggested tone for this city
  characteristics JSONB, -- Array of city characteristics
  
  -- Cache metadata
  ai_generated BOOLEAN DEFAULT true,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  cached_until TIMESTAMPTZ NOT NULL, -- cached_at + 90 days
  generation_model TEXT DEFAULT 'gpt-4o-mini',
  
  -- Constraints
  UNIQUE(city, country),
  CONSTRAINT valid_cache_duration CHECK (cached_until > cached_at)
);

-- Index for fast city lookups
CREATE INDEX IF NOT EXISTS idx_city_context_cache_city_country 
  ON public.city_context_cache(city, country);

-- Index for cache expiry cleanup
CREATE INDEX IF NOT EXISTS idx_city_context_cache_cached_until 
  ON public.city_context_cache(cached_until);

-- Enable RLS (Row Level Security)
ALTER TABLE public.city_context_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Public read access (city context is not sensitive)
CREATE POLICY "City context is publicly readable"
  ON public.city_context_cache
  FOR SELECT
  USING (true);

-- Policy: Only service role can insert/update (AI generation happens server-side)
CREATE POLICY "Service role can insert city context"
  ON public.city_context_cache
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update city context"
  ON public.city_context_cache
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- SEED DATA: Migrate existing hardcoded cities
-- ============================================================================
-- Populate with existing hardcoded cities from geographic-context.ts
-- Mark as NOT ai_generated (manual, high-quality baseline)

INSERT INTO public.city_context_cache (city, country, population, city_size, cultural_context, tone, characteristics, ai_generated, cached_until)
VALUES
  ('København', 'Denmark', 800000, 'capital', 
   'Danmarks hovedstad, internationalt beat, høj restaurantdensitet, trendsættende foodscene', 
   'Sofistikeret men tilgængelig',
   '["capital_city", "international", "high_competition", "trendsetter", "tourist_heavy"]'::jsonb,
   false,
   NOW() + INTERVAL '365 days' -- Manual entries cached for 1 year
  ),
  ('Aarhus', 'Denmark', 350000, 'major_city', 
   'Danmarks næststørste by, stor studiepopulation, voksende kulturscene og restaurantmiljø', 
   'Casual og tilgængelig',
   '["university_town", "second_city", "growing_foodscene", "younger_demographic", "cultural_hub"]'::jsonb,
   false,
   NOW() + INTERVAL '365 days'
  ),
  ('Odense', 'Denmark', 180000, 'medium_city', 
   'H.C. Andersens by, central beliggenhed på Fyn, balance mellem historisk charme og moderne foodscene', 
   'Venlig og tilgængelig',
   '["fairytale_city", "family_friendly", "cultural_heritage", "emerging_foodscene"]'::jsonb,
   false,
   NOW() + INTERVAL '365 days'
  ),
  ('Aalborg', 'Denmark', 120000, 'medium_city', 
   'Nordjyllands hovedstad, ung befolkning (universitets-by), voksende street food-scene', 
   'Casual og community-orienteret',
   '["university_town", "northern_gateway", "street_food", "student_friendly"]'::jsonb,
   false,
   NOW() + INTERVAL '365 days'
  ),
  ('Varde', 'Denmark', 8000, 'small_town', 
   'Vestjysk købstad, tæt community, nærhed til natur og Nordsøen', 
   'Personlig og community-centreret',
   '["small_town", "west_coast", "nature_proximity", "tight_community"]'::jsonb,
   false,
   NOW() + INTERVAL '365 days'
  )
ON CONFLICT (city, country) DO NOTHING;

-- ============================================================================
-- FUNCTION: Clean up expired cache entries
-- ============================================================================

CREATE OR REPLACE FUNCTION clean_expired_city_context_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.city_context_cache
  WHERE cached_until < NOW()
    AND ai_generated = true; -- Only delete AI-generated entries, keep manual ones
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.city_context_cache IS 'AI-generated city context cache for HYBRID persona system. Stores brief cultural context and population data for any city, cached for 90 days.';
COMMENT ON COLUMN public.city_context_cache.cultural_context IS 'AI-generated brief city context (20-30 words max). Example: "350k city, university town, growing foodscene"';
COMMENT ON COLUMN public.city_context_cache.cached_until IS 'Cache expiry date (typically cached_at + 90 days for AI-generated, +1 year for manual)';
COMMENT ON COLUMN public.city_context_cache.ai_generated IS 'TRUE if generated by AI, FALSE if manually curated (manual entries have longer cache duration)';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify table was created
SELECT 
  'city_context_cache created' as status,
  COUNT(*) as seeded_cities
FROM public.city_context_cache;
