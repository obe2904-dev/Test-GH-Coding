-- ============================================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================================
-- Purpose: Create city_context_cache table for HYBRID persona approach
-- This script is safe to run multiple times (CREATE IF NOT EXISTS)
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
  cultural_context TEXT NOT NULL,
  tone TEXT,
  characteristics JSONB,
  
  -- Cache metadata
  ai_generated BOOLEAN DEFAULT true,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  cached_until TIMESTAMPTZ NOT NULL,
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

-- Enable RLS
ALTER TABLE public.city_context_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Public read access
DROP POLICY IF EXISTS "City context is publicly readable" ON public.city_context_cache;
CREATE POLICY "City context is publicly readable"
  ON public.city_context_cache
  FOR SELECT
  USING (true);

-- Policy: Service role can insert/update
DROP POLICY IF EXISTS "Service role can insert city context" ON public.city_context_cache;
CREATE POLICY "Service role can insert city context"
  ON public.city_context_cache
  FOR INSERT
  WITH CHECK (true);  -- Changed from auth.role() check since edge functions use service role

DROP POLICY IF EXISTS "Service role can update city context" ON public.city_context_cache;
CREATE POLICY "Service role can update city context"
  ON public.city_context_cache
  FOR UPDATE
  USING (true);

-- Seed data (5 Danish cities)
INSERT INTO public.city_context_cache (city, country, population, city_size, cultural_context, tone, characteristics, ai_generated, cached_until)
VALUES
  ('København', 'Denmark', 800000, 'capital', 
   'Danmarks hovedstad, internationalt beat, høj restaurantdensitet, trendsættende foodscene', 
   'Sofistikeret men tilgængelig',
   '["capital_city", "international", "high_competition", "trendsetter", "tourist_heavy"]'::jsonb,
   false,
   NOW() + INTERVAL '365 days'
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

-- Verify
SELECT 
  'city_context_cache created' as status,
  COUNT(*) as seeded_cities
FROM public.city_context_cache;
