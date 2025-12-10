-- Migration 002: Comprehensive Business Schema
-- Extends profiles with full business information for AI-powered post generation
-- Design: One business per user, multiple users per business (team feature for paid plans)

-- ===============================
-- BUSINESSES (MAIN ENTITY)
-- ===============================
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vertical TEXT NOT NULL, -- e.g. restaurant, retail, beauty, fitness, professional, etc.
  website_url TEXT,
  primary_language TEXT DEFAULT 'da',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id) -- One business per user (owner)
);

-- ===============================
-- BUSINESS TEAM MEMBERS (MULTI-USER SUPPORT)
-- For paid plans: allow multiple users to collaborate on one business
-- ===============================
CREATE TABLE IF NOT EXISTS public.business_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(business_id, user_id)
);

-- ===============================
-- BUSINESS PROFILE (DESCRIPTIONS)
-- ===============================
CREATE TABLE IF NOT EXISTS public.business_profile (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  short_description TEXT,
  long_description TEXT,
  price_level TEXT CHECK (price_level IN ('low', 'medium', 'high')),
  target_audience TEXT,
  founded_year INTEGER CHECK (founded_year >= 1800 AND founded_year <= EXTRACT(YEAR FROM NOW())),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================
-- BRAND PROFILE (TONE, VALUES)
-- ===============================
CREATE TABLE IF NOT EXISTS public.business_brand_profile (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  tone_keywords TEXT[], -- ["hyggelig", "uformel", "lokal"]
  voice_style TEXT, -- "du-form, emojis ok"
  values TEXT[], -- ["økologisk", "bæredygtig"]
  certifications TEXT[], -- ["Ø-mærket", "Fairtrade"]
  do_not_say JSONB, -- {"words": ["cheap", "fast food"]}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================
-- LOCATIONS & CONTACT INFO
-- ===============================
CREATE TABLE IF NOT EXISTS public.business_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  label TEXT, -- optional name for the location
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

-- ===============================
-- OPENING HOURS
-- ===============================
CREATE TABLE IF NOT EXISTS public.opening_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  weekday TEXT NOT NULL CHECK (weekday IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  open_time TIME,
  close_time TIME,
  closed BOOLEAN DEFAULT FALSE,
  kind TEXT DEFAULT 'normal' CHECK (kind IN ('normal', 'kitchen', 'holiday')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================
-- SOCIAL ACCOUNTS
-- ===============================
CREATE TABLE IF NOT EXISTS public.social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'tiktok', 'linkedin', 'twitter')),
  handle TEXT,
  profile_url TEXT,
  is_connected BOOLEAN DEFAULT FALSE,
  access_token_encrypted TEXT, -- For future OAuth integration
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, platform)
);

-- ===============================
-- MEDIA ASSETS
-- ===============================
CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  type TEXT CHECK (type IN ('photo', 'logo', 'menu_pdf', 'video')),
  category_tags TEXT[], -- ["food", "interior"]
  ai_labels JSONB, -- ["burger","latte","modern interior"]
  is_hero BOOLEAN DEFAULT FALSE,
  is_interior BOOLEAN DEFAULT FALSE,
  is_exterior BOOLEAN DEFAULT FALSE,
  is_team BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================
-- OFFERINGS (MENU ITEMS / SERVICES / PRODUCTS)
-- UNIVERSAL FOR ALL BUSINESS TYPES
-- ===============================
CREATE TABLE IF NOT EXISTS public.offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('menu_item', 'service', 'product')),
  category TEXT, -- Burgers, Haircut, Pastries...
  tags TEXT[], -- vegan, brunch, balayage, wedding
  dietary_tags TEXT[], -- vegan, gluten_free
  is_signature BOOLEAN DEFAULT FALSE,
  is_seasonal BOOLEAN DEFAULT FALSE,
  season_label TEXT,
  price_min NUMERIC(10, 2),
  price_max NUMERIC(10, 2),
  active BOOLEAN DEFAULT TRUE,
  metadata JSONB, -- duration, special fields, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================
-- SPECIALS / DEALS / EVENTS
-- ===============================
CREATE TABLE IF NOT EXISTS public.specials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('deal', 'event', 'seasonal_offer', 'loyalty')),
  start_date DATE,
  end_date DATE,
  recurrence_rule TEXT, -- "every Tuesday", "monthly"
  price_info TEXT,
  link_url TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================
-- WEBSITE ANALYSIS LOG
-- ===============================
CREATE TABLE IF NOT EXISTS public.website_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'error')),
  last_run_at TIMESTAMPTZ,
  raw_result JSONB, -- AI full output
  error_message TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================
-- MIGRATE EXISTING PROFILES DATA
-- ===============================
-- Create businesses for existing users who have business_type set
INSERT INTO public.businesses (owner_id, name, vertical, primary_language)
SELECT 
  p.id,
  COALESCE(p.email, 'My Business'), -- Temporary name, user can update
  COALESCE(p.business_type, 'other'),
  'da'
FROM public.profiles p
WHERE p.business_type IS NOT NULL
ON CONFLICT (owner_id) DO NOTHING;

-- ===============================
-- ROW LEVEL SECURITY POLICIES
-- ===============================

-- Businesses table
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own business"
  ON public.businesses FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own business"
  ON public.businesses FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own business"
  ON public.businesses FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own business"
  ON public.businesses FOR DELETE
  USING (owner_id = auth.uid());

-- Business team members (for future multi-user support)
ALTER TABLE public.business_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their team"
  ON public.business_team_members FOR SELECT
  USING (
    user_id = auth.uid() OR 
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

-- Business profile
ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their business profile"
  ON public.business_profile FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Brand profile
ALTER TABLE public.business_brand_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their brand profile"
  ON public.business_brand_profile FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Locations
ALTER TABLE public.business_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their business locations"
  ON public.business_locations FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Opening hours
ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their opening hours"
  ON public.opening_hours FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Social accounts
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their social accounts"
  ON public.social_accounts FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Media assets
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their media assets"
  ON public.media_assets FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Offerings
ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their offerings"
  ON public.offerings FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Specials
ALTER TABLE public.specials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their specials"
  ON public.specials FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Website analyses
ALTER TABLE public.website_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their website analyses"
  ON public.website_analyses FOR SELECT
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert website analyses"
  ON public.website_analyses FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- ===============================
-- TRIGGER FUNCTIONS FOR TIMESTAMPS
-- ===============================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_business_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER on_businesses_updated
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_business_updated_at();

CREATE TRIGGER on_business_profile_updated
  BEFORE UPDATE ON public.business_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_business_updated_at();

CREATE TRIGGER on_brand_profile_updated
  BEFORE UPDATE ON public.business_brand_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_business_updated_at();

CREATE TRIGGER on_offerings_updated
  BEFORE UPDATE ON public.offerings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_business_updated_at();

-- ===============================
-- HELPER FUNCTION: Auto-create business on user signup
-- ===============================
CREATE OR REPLACE FUNCTION public.handle_new_user_business()
RETURNS TRIGGER AS $$
BEGIN
  -- Create a default business for new user
  INSERT INTO public.businesses (owner_id, name, vertical, primary_language)
  VALUES (NEW.id, 'My Business', 'other', 'da');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create business when new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created_business ON auth.users;
CREATE TRIGGER on_auth_user_created_business
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_business();

-- ===============================
-- INDEXES FOR PERFORMANCE
-- ===============================
CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON public.businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_business_locations_business_id ON public.business_locations(business_id);
CREATE INDEX IF NOT EXISTS idx_offerings_business_id ON public.offerings(business_id);
CREATE INDEX IF NOT EXISTS idx_specials_business_id ON public.specials(business_id);
CREATE INDEX IF NOT EXISTS idx_website_analyses_business_id ON public.website_analyses(business_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_business_id ON public.social_accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_team_members_business_id ON public.business_team_members(business_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.business_team_members(user_id);

-- ===============================
-- COMMENTS FOR DOCUMENTATION
-- ===============================
COMMENT ON TABLE public.businesses IS 'Main business entity - one per user (owner), supports team members for paid plans';
COMMENT ON TABLE public.business_profile IS 'Detailed business description and positioning information';
COMMENT ON TABLE public.business_brand_profile IS 'Brand voice, tone, values for AI content generation';
COMMENT ON TABLE public.business_locations IS 'Physical locations with contact info';
COMMENT ON TABLE public.opening_hours IS 'Business hours for each location';
COMMENT ON TABLE public.social_accounts IS 'Connected social media accounts';
COMMENT ON TABLE public.media_assets IS 'Photos, logos, and other media for post generation';
COMMENT ON TABLE public.offerings IS 'Menu items, services, or products offered';
COMMENT ON TABLE public.specials IS 'Deals, events, seasonal offers';
COMMENT ON TABLE public.website_analyses IS 'Log of AI website analysis runs and results';
COMMENT ON COLUMN public.businesses.vertical IS 'Business type: restaurant, retail, beauty, fitness, professional, realestate, healthcare, education, other';
