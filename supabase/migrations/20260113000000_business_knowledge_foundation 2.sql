-- =====================================================
-- POST2GROW: Business Knowledge Foundation Schema
-- =====================================================
-- Version: 1.0
-- Created: 2026-01-13
-- Purpose: Establish normalized database schema for AI-powered
--          social media content generation for Danish hospitality
--
-- Categories:
--   1-2: Business Identity & Location
--   3:   Operational Profile
--   4:   Offerings & Menu
--   5-6: Brand Voice & Visual Identity
--   7:   Platform Intelligence
--   8:   Business Goals
--   9:   Audience & Market
-- =====================================================

-- =====================================================
-- CATEGORY 1 & 2: BUSINESS IDENTITY & LOCATION
-- =====================================================

-- Note: 'businesses' table already exists with core identity fields
-- This table extends it with AI-powered location intelligence

CREATE TABLE IF NOT EXISTS business_location_intelligence (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Geographic context (AI-populated from Google Maps API)
  neighborhood text,
  neighborhood_character text, -- e.g., "Historic harbor district with cobblestone streets"
  area_type text, -- 'old_town', 'harbor_front', 'residential', 'business_district'
  
  -- Coordinates for mapping
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  
  -- Proximity data (JSONB for flexibility - AI populates)
  landmarks_nearby jsonb DEFAULT '[]'::jsonb,
  -- Structure: [{name: "Nyhavn", type: "tourist_attraction", walking_minutes: 2, marketing_angle: "Steps from colorful harbor"}]
  
  public_transport jsonb DEFAULT '{}'::jsonb,
  -- Structure: {metro_stations: [{name: "Kongens Nytorv", line: "M1", walking_minutes: 3}], bus_stops: [], parking: {available: true, type: "street"}}
  
  -- Location assets
  has_view boolean DEFAULT false,
  view_type text[], -- ['water', 'courtyard', 'street', 'garden']
  outdoor_space_type text, -- 'terrace', 'courtyard', 'sidewalk', 'rooftop', 'garden'
  
  -- Marketing hooks (AI-generated based on location)
  location_marketing_hooks text[], -- ['Hidden gem by canal', '2 min from Nyhavn', 'Quiet courtyard in the heart of the city']
  
  -- User-editable flags
  is_hidden_gem boolean DEFAULT false,
  street_visibility text, -- 'high', 'medium', 'low', 'hidden'
  
  -- Metadata
  last_updated_by_ai timestamptz,
  user_confirmed_at timestamptz, -- When user reviewed and confirmed AI data
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE business_location_intelligence IS 'AI-powered location context for marketing content generation';
COMMENT ON COLUMN business_location_intelligence.landmarks_nearby IS 'Nearby landmarks for location-based content hooks';
COMMENT ON COLUMN business_location_intelligence.location_marketing_hooks IS 'AI-generated location selling points';

-- Index for geospatial queries (if needed later)
CREATE INDEX IF NOT EXISTS idx_business_location_coordinates 
  ON business_location_intelligence(latitude, longitude);

-- =====================================================
-- CATEGORY 3: OPERATIONAL PROFILE
-- =====================================================

CREATE TABLE IF NOT EXISTS business_operations (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Opening hours (structured JSONB)
  opening_hours jsonb DEFAULT '{}'::jsonb,
  -- Structure: {monday: {open: "08:00", close: "22:00", closed: false}, tuesday: {...}, ...}
  
  -- Service periods (breakfast, brunch, lunch, dinner, late_night)
  service_periods jsonb DEFAULT '{}'::jsonb,
  -- Structure: {breakfast: {available: true, days: ["monday", "tuesday"], hours: {start: "08:00", end: "11:00"}}, ...}
  
  -- Capacity patterns (historical data - not real-time)
  typical_busy_periods jsonb DEFAULT '[]'::jsonb,
  -- Structure: [{day: "friday", period: "dinner", capacity_pct: 95, notes: "Pre-booking recommended"}]
  
  typical_slow_periods jsonb DEFAULT '[]'::jsonb,
  -- Structure: [{day: "wednesday", period: "lunch", capacity_pct: 40, marketing_opportunity: true}]
  
  -- Seating capacity
  seating_capacity_indoor integer,
  seating_capacity_outdoor integer,
  
  -- Pricing
  price_level text CHECK (price_level IN ('budget', 'moderate', 'upscale', 'fine_dining')),
  average_check_per_person integer, -- in local currency (DKK)
  currency text DEFAULT 'DKK',
  
  -- Service model
  has_table_service boolean DEFAULT true,
  has_takeaway boolean DEFAULT false,
  has_delivery boolean DEFAULT false,
  reservation_required boolean DEFAULT false,
  accepts_walk_ins boolean DEFAULT true,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE business_operations IS 'Operational details for capacity-based content generation';
COMMENT ON COLUMN business_operations.typical_slow_periods IS 'Identifies opportunities for fill-gap marketing';
COMMENT ON COLUMN business_operations.service_periods IS 'Time-based service offerings for targeted content';

-- Index for querying by price level
CREATE INDEX IF NOT EXISTS idx_business_operations_price_level 
  ON business_operations(price_level);

-- =====================================================
-- CATEGORY 4: OFFERINGS & MENU METADATA
-- =====================================================

-- Note: Existing menu tables (menu_sources, menu_extractions, menu_items) are kept
-- This table adds AI-friendly metadata layer

CREATE TABLE IF NOT EXISTS business_menu_metadata (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Menu update tracking
  last_updated timestamptz,
  update_frequency text, -- 'seasonal', 'monthly', 'quarterly', 'annually'
  next_planned_update date,
  
  -- Menu statistics (auto-calculated from menu_items)
  total_items_count integer DEFAULT 0,
  signature_items_count integer DEFAULT 0,
  seasonal_items_count integer DEFAULT 0,
  
  -- Sourcing & philosophy
  local_ingredients_pct integer CHECK (local_ingredients_pct >= 0 AND local_ingredients_pct <= 100),
  organic_certified boolean DEFAULT false,
  sustainability_focus text[], -- ['local_sourcing', 'zero_waste', 'seasonal', 'organic']
  food_philosophy text, -- "New Nordic", "French bistro", "Farm-to-table", "Comfort food"
  
  -- Beverage program
  has_specialty_coffee boolean DEFAULT false,
  coffee_roaster text, -- Name of coffee supplier/roaster
  has_full_bar boolean DEFAULT false,
  has_wine_list boolean DEFAULT false,
  wine_list_focus text, -- 'natural', 'french', 'new_world', 'sommelier_curated'
  
  -- Dietary accommodations
  dietary_options text[], -- ['vegetarian', 'vegan', 'gluten_free', 'lactose_free', 'halal', 'kosher']
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE business_menu_metadata IS 'Menu intelligence layer for content generation context';
COMMENT ON COLUMN business_menu_metadata.food_philosophy IS 'Culinary identity for brand voice consistency';
COMMENT ON COLUMN business_menu_metadata.local_ingredients_pct IS 'Percentage of locally sourced ingredients for sustainability content';

-- =====================================================
-- CATEGORY 5 & 6: BRAND VOICE & VISUAL IDENTITY
-- =====================================================

-- Note: business_brand_profile table already exists for brand voice
-- Adding visual identity table

CREATE TABLE IF NOT EXISTS business_visual_identity (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Photography style (JSONB for flexibility)
  photography_style jsonb DEFAULT '{}'::jsonb,
  -- Structure: {
  --   overall_aesthetic: "warm_natural_light", 
  --   lighting_preference: "natural", 
  --   composition_style: "overhead_flatlays",
  --   color_temperature: "warm",
  --   mood: "cozy_inviting"
  -- }
  
  -- Platform-specific visual guidelines
  platform_visuals jsonb DEFAULT '{}'::jsonb,
  -- Structure: {
  --   instagram: {aspect_ratio: "4:5", primary_format: "photo", use_reels: true}, 
  --   facebook: {aspect_ratio: "1:1", primary_format: "photo"}
  -- }
  
  -- Recognizable interior identity
  interior_style text, -- 'scandinavian_minimalist', 'industrial_chic', 'vintage_cozy', 'modern_elegant'
  signature_visual_elements text[], -- ['exposed_brick', 'hanging_plants', 'marble_tables', 'neon_sign']
  
  -- Color palette (if defined)
  primary_colors jsonb DEFAULT '[]'::jsonb,
  -- Structure: [{color: "#8B7355", name: "Earth Brown", usage: "Accents and brand elements"}]
  
  -- Logo & branding assets
  logo_url text,
  has_consistent_branding boolean DEFAULT false,
  
  -- Photo library preferences
  preferred_photo_subjects text[], -- ['food_closeups', 'lifestyle_shots', 'interior_ambiance', 'staff_portraits']
  avoid_photo_types text[], -- ['too_dark', 'heavy_filters', 'text_overlays']
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE business_visual_identity IS 'Visual brand guidelines for AI image selection and caption generation';
COMMENT ON COLUMN business_visual_identity.photography_style IS 'Defines visual consistency for content generation';
COMMENT ON COLUMN business_visual_identity.signature_visual_elements IS 'Recognizable brand elements to highlight in content';

-- =====================================================
-- CATEGORY 7: PLATFORM INTELLIGENCE (GLOBAL)
-- =====================================================

-- This is GLOBAL knowledge shared across all businesses
-- Single-row table with platform algorithm insights

CREATE TABLE IF NOT EXISTS platform_intelligence (
  id integer PRIMARY KEY DEFAULT 1, -- Only one row allowed
  
  -- Instagram algorithm knowledge
  instagram_algorithm jsonb DEFAULT '{}'::jsonb,
  -- Structure: {
  --   optimal_posting_times: {weekday: ["12:00", "18:00"], weekend: ["10:00", "20:00"]},
  --   engagement_triggers: ["questions", "user_tags", "location_tags"],
  --   content_types_ranking: ["reels", "carousel", "static_photo"],
  --   hashtag_best_practices: {...}
  -- }
  
  -- Facebook algorithm knowledge
  facebook_algorithm jsonb DEFAULT '{}'::jsonb,
  -- Structure: {
  --   optimal_posting_times: {...},
  --   engagement_triggers: ["native_video", "question_posts"],
  --   content_length_preferences: {...}
  -- }
  
  -- Google My Business knowledge
  google_my_business jsonb DEFAULT '{}'::jsonb,
  -- Structure: {
  --   post_frequency_recommendation: "3-5 per week",
  --   optimal_post_types: ["offers", "events", "updates"],
  --   character_limits: {...}
  -- }
  
  -- Industry benchmarks (hospitality sector)
  industry_benchmarks jsonb DEFAULT '{}'::jsonb,
  -- Structure: {
  --   average_engagement_rate: {instagram: 3.2, facebook: 1.8},
  --   typical_posting_frequency: {...}
  -- }
  
  -- Last updated
  last_updated timestamptz DEFAULT now(),
  version integer DEFAULT 1,
  
  -- Ensure only one row
  CONSTRAINT single_row CHECK (id = 1)
);

COMMENT ON TABLE platform_intelligence IS 'Global platform algorithm knowledge for optimal content strategy';
COMMENT ON COLUMN platform_intelligence.instagram_algorithm IS 'Current Instagram algorithm best practices';

-- Insert initial empty row
INSERT INTO platform_intelligence (id, instagram_algorithm, facebook_algorithm, google_my_business, industry_benchmarks)
VALUES (
  1,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- CATEGORY 8: BUSINESS GOALS
-- =====================================================

CREATE TABLE IF NOT EXISTS business_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Goal definition
  goal_type text NOT NULL CHECK (goal_type IN (
    'fill_timeslot',           -- Fill slow periods
    'promote_offering',        -- Promote specific menu item/service
    'build_awareness',         -- Increase brand visibility
    'drive_reservations',      -- Get more bookings
    'increase_engagement',     -- Social media engagement
    'launch_new_offering',     -- Introduce new menu item
    'seasonal_campaign'        -- Holiday/seasonal push
  )),
  priority text NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  title text NOT NULL,
  description text NOT NULL,
  
  -- Target metric
  target_metric jsonb NOT NULL,
  -- Structure: {
  --   metric: "bookings",
  --   current_value: 18,
  --   target_value: 32,
  --   target_date: "2026-03-31",
  --   measurement_unit: "per_week"
  -- }
  
  -- Time constraints (when to promote this goal)
  time_constraints jsonb DEFAULT '{}'::jsonb,
  -- Structure: {
  --   target_days: ["wednesday", "thursday"],
  --   target_periods: ["lunch"],
  --   avoid_days: ["friday", "saturday"],
  --   start_date: "2026-01-15",
  --   end_date: "2026-03-31"
  -- }
  
  -- Target audience for this goal
  target_audience_segment jsonb DEFAULT '{}'::jsonb,
  -- Structure: {
  --   demographics: ["young_professionals", "families"],
  --   behaviors: ["lunch_seekers", "nearby_office_workers"]
  -- }
  
  -- Promotional hook (how to message this)
  promotional_hook jsonb DEFAULT '{}'::jsonb,
  -- Structure: {
  --   offer_type: "discount" | "special_menu" | "experience",
  --   message_angle: "Beat the lunch rush - quiet tables available",
  --   cta: "Book your quiet lunch spot"
  -- }
  
  -- Progress tracking
  status text DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'achieved', 'paused', 'abandoned')),
  progress_pct integer DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  notes text, -- User notes on progress
  
  -- Metadata
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE business_goals IS 'Strategic objectives driving AI content generation priorities';
COMMENT ON COLUMN business_goals.goal_type IS 'Category of business objective';
COMMENT ON COLUMN business_goals.time_constraints IS 'When to focus content on this goal';
COMMENT ON COLUMN business_goals.promotional_hook IS 'How to message this goal in content';

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_business_goals_business_id ON business_goals(business_id);
CREATE INDEX IF NOT EXISTS idx_business_goals_status ON business_goals(status);
CREATE INDEX IF NOT EXISTS idx_business_goals_priority ON business_goals(priority);
CREATE INDEX IF NOT EXISTS idx_business_goals_type ON business_goals(goal_type);

-- Composite index for active goals query
CREATE INDEX IF NOT EXISTS idx_business_goals_active 
  ON business_goals(business_id, status, priority) 
  WHERE status IN ('not_started', 'in_progress');

-- =====================================================
-- CATEGORY 9: AUDIENCE & MARKET
-- =====================================================

CREATE TABLE IF NOT EXISTS business_audience_profile (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Customer segments (JSONB for flexibility)
  customer_segments jsonb DEFAULT '[]'::jsonb,
  -- Structure: [{
  --   segment_name: "Young Professionals",
  --   characteristics: ["25-35 years", "urban", "disposable income"],
  --   behaviors: ["weekday lunch", "after-work drinks", "instagram-active"],
  --   preferences: ["quick service", "instagram-worthy", "healthy options"],
  --   marketing_insights: "Respond well to lifestyle content and lunch specials"
  -- }]
  
  -- Social media audience data
  social_media_audience jsonb DEFAULT '{}'::jsonb,
  -- Structure: {
  --   instagram: {
  --     follower_count: 3200,
  --     engagement_rate: 4.2,
  --     top_demographics: ["25-34: 45%", "35-44: 30%"],
  --     peak_activity_times: ["12:00", "18:00", "20:00"]
  --   },
  --   facebook: {...}
  -- }
  
  -- Market position
  market_position jsonb DEFAULT '{}'::jsonb,
  -- Structure: {
  --   positioning_statement: "Cozy neighborhood café for quality coffee and homemade brunch",
  --   unique_selling_points: ["house-roasted coffee", "all-day brunch", "quiet courtyard"],
  --   target_reputation: "hidden_gem" | "neighborhood_favorite" | "destination"
  -- }
  
  -- Competitive positioning
  main_competitors jsonb DEFAULT '[]'::jsonb,
  -- Structure: [{
  --   name: "Café Central",
  --   competitive_advantage: "We have outdoor seating and longer hours",
  --   differentiation: "More intimate atmosphere"
  -- }]
  
  -- Local market insights
  local_market_trends text[], -- ['specialty_coffee_growth', 'brunch_culture', 'instagram_culture']
  seasonal_customer_patterns text, -- e.g., "Tourist-heavy in summer, locals in winter"
  
  -- Metadata
  last_updated timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE business_audience_profile IS 'Audience intelligence for targeted content generation';
COMMENT ON COLUMN business_audience_profile.customer_segments IS 'Defined customer personas for content personalization';
COMMENT ON COLUMN business_audience_profile.market_position IS 'How the business wants to be perceived';

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE business_location_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_menu_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_visual_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_audience_profile ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS: business_location_intelligence
-- =====================================================

CREATE POLICY "Users can read their business location data"
  ON business_location_intelligence FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their business location data"
  ON business_location_intelligence FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their business location data"
  ON business_location_intelligence FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- =====================================================
-- RLS: business_operations
-- =====================================================

CREATE POLICY "Users can read their business operations"
  ON business_operations FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their business operations"
  ON business_operations FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their business operations"
  ON business_operations FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- =====================================================
-- RLS: business_menu_metadata
-- =====================================================

CREATE POLICY "Users can read their menu metadata"
  ON business_menu_metadata FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their menu metadata"
  ON business_menu_metadata FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their menu metadata"
  ON business_menu_metadata FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- =====================================================
-- RLS: business_visual_identity
-- =====================================================

CREATE POLICY "Users can read their visual identity"
  ON business_visual_identity FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their visual identity"
  ON business_visual_identity FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their visual identity"
  ON business_visual_identity FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- =====================================================
-- RLS: platform_intelligence (GLOBAL - READ ONLY)
-- =====================================================

CREATE POLICY "Authenticated users can read platform intelligence"
  ON platform_intelligence FOR SELECT
  TO authenticated
  USING (true);

-- Service role can manage platform intelligence
CREATE POLICY "Service role can manage platform intelligence"
  ON platform_intelligence FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- RLS: business_goals
-- =====================================================

CREATE POLICY "Users can read their business goals"
  ON business_goals FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their business goals"
  ON business_goals FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their business goals"
  ON business_goals FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their business goals"
  ON business_goals FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- =====================================================
-- RLS: business_audience_profile
-- =====================================================

CREATE POLICY "Users can read their audience profile"
  ON business_audience_profile FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their audience profile"
  ON business_audience_profile FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their audience profile"
  ON business_audience_profile FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- =====================================================
-- HELPER FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to all tables with updated_at
CREATE TRIGGER update_business_location_intelligence_updated_at
  BEFORE UPDATE ON business_location_intelligence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_operations_updated_at
  BEFORE UPDATE ON business_operations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_menu_metadata_updated_at
  BEFORE UPDATE ON business_menu_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_visual_identity_updated_at
  BEFORE UPDATE ON business_visual_identity
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_goals_updated_at
  BEFORE UPDATE ON business_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_audience_profile_updated_at
  BEFORE UPDATE ON business_audience_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- HELPER VIEWS (OPTIONAL - FOR DEBUGGING)
-- =====================================================

-- View to see all knowledge for a business (JOIN all tables)
-- Note: Simplified to avoid referencing unknown columns from businesses table
CREATE OR REPLACE VIEW business_knowledge_complete AS
SELECT 
  b.id as business_id,
  bli.neighborhood,
  bli.location_marketing_hooks,
  bli.area_type,
  bo.price_level,
  bo.opening_hours,
  bo.seating_capacity_indoor,
  bmm.food_philosophy,
  bmm.signature_items_count,
  bmm.total_items_count,
  bvi.interior_style,
  bvi.photography_style,
  COUNT(DISTINCT bg.id) as active_goals_count,
  bap.market_position
FROM businesses b
LEFT JOIN business_location_intelligence bli ON b.id = bli.business_id
LEFT JOIN business_operations bo ON b.id = bo.business_id
LEFT JOIN business_menu_metadata bmm ON b.id = bmm.business_id
LEFT JOIN business_visual_identity bvi ON b.id = bvi.business_id
LEFT JOIN business_goals bg ON b.id = bg.business_id AND bg.status IN ('not_started', 'in_progress')
LEFT JOIN business_audience_profile bap ON b.id = bap.business_id
GROUP BY b.id, bli.neighborhood, bli.location_marketing_hooks, bli.area_type,
         bo.price_level, bo.opening_hours, bo.seating_capacity_indoor,
         bmm.food_philosophy, bmm.signature_items_count, bmm.total_items_count,
         bvi.interior_style, bvi.photography_style, bap.market_position;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant authenticated users access to the view
GRANT SELECT ON business_knowledge_complete TO authenticated;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Business Knowledge Foundation schema created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - business_location_intelligence';
  RAISE NOTICE '  - business_operations';
  RAISE NOTICE '  - business_menu_metadata';
  RAISE NOTICE '  - business_visual_identity';
  RAISE NOTICE '  - platform_intelligence';
  RAISE NOTICE '  - business_goals';
  RAISE NOTICE '  - business_audience_profile';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Helper view created: business_knowledge_complete';
  RAISE NOTICE '🔒 RLS policies enabled on all tables';
  RAISE NOTICE '⚙️  Triggers added for auto-updating updated_at';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Test by inserting data for a business';
  RAISE NOTICE '  2. Verify RLS by querying as authenticated user';
  RAISE NOTICE '  3. Populate platform_intelligence with algorithm data';
END $$;
