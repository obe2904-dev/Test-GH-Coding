-- COMPLETE DATABASE RESTORATION
-- Run this in Supabase SQL Editor to restore ALL critical functionality
-- This fixes: login, signup, onboarding, and the offerings_full column

-- ============================================
-- 1. CORE TABLES
-- ============================================

-- Businesses table (CRITICAL - everything depends on this)
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vertical TEXT NOT NULL,
  category TEXT,
  website_url TEXT,
  logo_url TEXT,
  subscription_tier TEXT DEFAULT 'free',
  primary_language TEXT DEFAULT 'da',
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id)
);

-- Add missing columns if table already exists
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own business" ON public.businesses;
CREATE POLICY "Users can view own business"
  ON public.businesses FOR SELECT
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own business" ON public.businesses;
CREATE POLICY "Users can insert own business"
  ON public.businesses FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own business" ON public.businesses;
CREATE POLICY "Users can update own business"
  ON public.businesses FOR UPDATE
  USING (owner_id = auth.uid());

-- Business locations table
CREATE TABLE IF NOT EXISTS public.business_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  label TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'Denmark',
  maps_url TEXT,
  phone TEXT,
  email TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.business_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their business locations" ON public.business_locations;
CREATE POLICY "Users can manage their business locations"
  ON public.business_locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_locations.business_id
      AND b.owner_id = auth.uid()
    )
  );

-- ============================================
-- 2. AUTH TRIGGER (for new user signups)
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 3. ONBOARDING FUNCTION (CRITICAL for signup)
-- ============================================

CREATE OR REPLACE FUNCTION public.create_business_onboarding(
  p_user_id UUID,
  p_business_name TEXT,
  p_business_vertical TEXT,
  p_postal_code TEXT,
  p_city TEXT,
  p_country TEXT,
  p_selected_platforms TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  -- Create business record
  INSERT INTO public.businesses (
    owner_id,
    name,
    vertical,
    primary_language,
    plan,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_business_name,
    p_business_vertical,
    'da',
    'free',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_business_id;

  -- Create business location record
  INSERT INTO public.business_locations (
    business_id,
    postal_code,
    city,
    country,
    is_primary,
    created_at
  )
  VALUES (
    v_business_id,
    p_postal_code,
    p_city,
    p_country,
    TRUE,
    NOW()
  );

  -- Update profile
  UPDATE public.profiles
  SET
    selected_platforms = to_jsonb(p_selected_platforms),
    onboarding_completed = TRUE,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_business_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_business_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;

-- ============================================
-- 4. MENU TABLES (for menu extraction/management)
-- ============================================

-- Menu sources table
CREATE TABLE IF NOT EXISTS public.menu_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('url', 'pdf')),
  file_name TEXT,
  menu_type TEXT NOT NULL DEFAULT 'standard' CHECK (menu_type IN ('standard', 'special')),
  source_origin TEXT NOT NULL CHECK (source_origin IN ('ai_detected', 'manual_added')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'extracting', 'extracted', 'ignored', 'error')),
  error_message TEXT,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(business_id, source_url)
);

CREATE INDEX IF NOT EXISTS idx_menu_sources_business_id ON public.menu_sources(business_id);
CREATE INDEX IF NOT EXISTS idx_menu_sources_status ON public.menu_sources(business_id, status);

ALTER TABLE public.menu_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own business menu sources" ON public.menu_sources;
CREATE POLICY "Users can view their own business menu sources"
  ON public.menu_sources FOR SELECT
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert menu sources for their business" ON public.menu_sources;
CREATE POLICY "Users can insert menu sources for their business"
  ON public.menu_sources FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update their own business menu sources" ON public.menu_sources;
CREATE POLICY "Users can update their own business menu sources"
  ON public.menu_sources FOR UPDATE
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own business menu sources" ON public.menu_sources;
CREATE POLICY "Users can delete their own business menu sources"
  ON public.menu_sources FOR DELETE
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Menu results v2 table
CREATE TABLE IF NOT EXISTS public.menu_results_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL DEFAULT 'url' CHECK (source_kind IN ('url', 'storage')),
  source_url TEXT,
  source_content_type TEXT,
  storage_bucket TEXT,
  storage_path TEXT,
  sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'error')),
  language_code TEXT DEFAULT 'da',
  attempts INTEGER NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  extraction_method TEXT,
  raw_text TEXT,
  structured_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_results_v2_status_created_at ON public.menu_results_v2(status, created_at);
CREATE INDEX IF NOT EXISTS idx_menu_results_v2_business_status ON public.menu_results_v2(business_id, status);

ALTER TABLE public.menu_results_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their business menu results v2" ON public.menu_results_v2;
CREATE POLICY "Users can view their business menu results v2"
  ON public.menu_results_v2 FOR SELECT
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

GRANT SELECT ON TABLE public.menu_results_v2 TO authenticated;

-- ============================================
-- 5. OPERATIONS & LOCATION INTELLIGENCE TABLES
-- ============================================

-- Business location intelligence table
CREATE TABLE IF NOT EXISTS public.business_location_intelligence (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  neighborhood TEXT,
  neighborhood_character TEXT,
  area_type TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  landmarks_nearby JSONB DEFAULT '[]'::jsonb,
  public_transport JSONB DEFAULT '{}'::jsonb,
  has_view BOOLEAN DEFAULT false,
  view_type TEXT[],
  outdoor_space_type TEXT,
  location_marketing_hooks TEXT[],
  is_hidden_gem BOOLEAN DEFAULT false,
  street_visibility TEXT,
  last_updated_by_ai TIMESTAMPTZ,
  user_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_location_coordinates ON public.business_location_intelligence(latitude, longitude);

ALTER TABLE public.business_location_intelligence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their business location intelligence" ON public.business_location_intelligence;
CREATE POLICY "Users can view their business location intelligence"
  ON public.business_location_intelligence FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Business operations table
CREATE TABLE IF NOT EXISTS public.business_operations (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  opening_hours JSONB DEFAULT '{}'::jsonb,
  service_periods JSONB DEFAULT '{}'::jsonb,
  typical_busy_periods JSONB DEFAULT '[]'::jsonb,
  typical_slow_periods JSONB DEFAULT '[]'::jsonb,
  seating_capacity_indoor INTEGER,
  seating_capacity_outdoor INTEGER,
  price_level TEXT CHECK (price_level IN ('budget', 'moderate', 'upscale', 'fine_dining')),
  average_check_per_person INTEGER,
  currency TEXT DEFAULT 'DKK',
  has_table_service BOOLEAN DEFAULT true,
  has_takeaway BOOLEAN DEFAULT false,
  has_delivery BOOLEAN DEFAULT false,
  reservation_required BOOLEAN DEFAULT false,
  accepts_walk_ins BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_operations_price_level ON public.business_operations(price_level);

ALTER TABLE public.business_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their business operations" ON public.business_operations;
CREATE POLICY "Users can view their business operations"
  ON public.business_operations FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- ============================================
-- 6. OFFERINGS_FULL COLUMN (for explainability)
-- ============================================

ALTER TABLE business_brand_profile ADD COLUMN IF NOT EXISTS offerings_full JSONB;
COMMENT ON COLUMN business_brand_profile.offerings_full IS 'All core offering candidates, scores, and evidence for explainability.';

-- ============================================
-- 7. VERIFICATION
-- ============================================

SELECT 
  '✅ COMPLETE DATABASE RESTORATION SUCCESSFUL' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'businesses') as businesses_table_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'business_locations') as locations_table_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'business_location_intelligence') as location_intelligence_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'business_operations') as operations_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'menu_sources') as menu_sources_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'menu_results_v2') as menu_results_v2_exists,
  (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created') as auth_trigger_exists,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name = 'create_business_onboarding') as onboarding_function_exists,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'business_brand_profile' AND column_name = 'offerings_full') as offerings_full_exists;
