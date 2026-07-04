-- =====================================================
-- LAYER 5: MENU SCORING SYSTEM
-- =====================================================
-- Adds columns to menu items for opportunity scoring

-- =====================================================
-- MENU ITEM ENHANCEMENTS
-- =====================================================
-- Note: menu_results_v2.structured_data is JSONB, so we add columns to track metadata

-- Add tracking columns to businesses for menu metadata
CREATE TABLE IF NOT EXISTS menu_item_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Menu item identification (path into structured_data JSONB)
  item_name TEXT NOT NULL,
  item_category TEXT, -- 'appetizer', 'main', 'dessert', 'drink', etc.
  item_section TEXT, -- 'breakfast', 'lunch', 'dinner', 'all_day'
  
  -- Scoring metadata
  is_signature BOOLEAN DEFAULT FALSE,
  is_seasonal BOOLEAN DEFAULT FALSE,
  is_limited_time BOOLEAN DEFAULT FALSE,
  
  -- Temperature classification for weather matching
  dish_temp_category TEXT CHECK (dish_temp_category IN ('cold', 'hot', 'warm', 'neutral')),
  
  -- Dates for scoring
  item_added_date TIMESTAMPTZ DEFAULT NOW(),
  item_available_from DATE, -- Seasonal start
  item_available_to DATE, -- Seasonal end
  last_posted_date TIMESTAMPTZ, -- Last time this item was featured in a post
  
  -- Location amplifiers (tags for location matching)
  location_tags TEXT[], -- e.g., ['seafood', 'waterfront', 'photogenic', 'local_specialty']
  
  -- Seasonal ingredient tags (for bonus scoring)
  seasonal_ingredients JSONB DEFAULT '[]'::jsonb,
  -- Format: ["asparagus", "new_potatoes", "rhubarb"]
  
  -- Performance tracking
  total_times_posted INTEGER DEFAULT 0,
  avg_engagement_rate DECIMAL(5,2) DEFAULT 0,
  last_engagement_rate DECIMAL(5,2),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one metadata record per item per business
  UNIQUE(business_id, item_name)
);

-- Indexes
CREATE INDEX idx_menu_metadata_business ON menu_item_metadata(business_id);
CREATE INDEX idx_menu_metadata_signature ON menu_item_metadata(is_signature) WHERE is_signature = TRUE;
CREATE INDEX idx_menu_metadata_seasonal ON menu_item_metadata(is_seasonal) WHERE is_seasonal = TRUE;
CREATE INDEX idx_menu_metadata_new ON menu_item_metadata(item_added_date DESC);
CREATE INDEX idx_menu_metadata_last_posted ON menu_item_metadata(last_posted_date);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_menu_metadata_updated_at
  BEFORE UPDATE ON menu_item_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEASONAL INGREDIENT REFERENCE
-- =====================================================
-- Lookup table for seasonal bonus scoring

CREATE TABLE IF NOT EXISTS seasonal_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_name TEXT NOT NULL,
  country_code TEXT DEFAULT 'DK', -- Denmark default, can expand
  season TEXT NOT NULL CHECK (season IN ('spring', 'summer', 'autumn', 'winter')),
  peak_months INTEGER[] NOT NULL, -- e.g., [3, 4, 5] for March-May
  bonus_points INTEGER DEFAULT 50,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(ingredient_name, country_code, season)
);

-- Index for fast lookups
CREATE INDEX idx_seasonal_country_season ON seasonal_ingredients(country_code, season);

-- Populate with Danish seasonal ingredients
INSERT INTO seasonal_ingredients (ingredient_name, country_code, season, peak_months, bonus_points) VALUES
-- Spring (March-May)
('asparagus', 'DK', 'spring', ARRAY[3, 4, 5], 50),
('asparges', 'DK', 'spring', ARRAY[3, 4, 5], 50),
('new potatoes', 'DK', 'spring', ARRAY[4, 5], 40),
('nye kartofler', 'DK', 'spring', ARRAY[4, 5], 40),
('peas', 'DK', 'spring', ARRAY[4, 5, 6], 40),
('ærter', 'DK', 'spring', ARRAY[4, 5, 6], 40),
('lamb', 'DK', 'spring', ARRAY[3, 4, 5], 45),
('lam', 'DK', 'spring', ARRAY[3, 4, 5], 45),
('rhubarb', 'DK', 'spring', ARRAY[4, 5, 6], 50),
('rabarber', 'DK', 'spring', ARRAY[4, 5, 6], 50),
('radishes', 'DK', 'spring', ARRAY[4, 5], 35),
('radiser', 'DK', 'spring', ARRAY[4, 5], 35),
('spring herbs', 'DK', 'spring', ARRAY[3, 4, 5], 30),
('forårskrydderier', 'DK', 'spring', ARRAY[3, 4, 5], 30),
('chervil', 'DK', 'spring', ARRAY[3, 4, 5], 30),
('kørvel', 'DK', 'spring', ARRAY[3, 4, 5], 30),

-- Summer (June-August)
('strawberries', 'DK', 'summer', ARRAY[6, 7], 50),
('jordbær', 'DK', 'summer', ARRAY[6, 7], 50),
('raspberries', 'DK', 'summer', ARRAY[7, 8], 50),
('hindbær', 'DK', 'summer', ARRAY[7, 8], 50),
('berries', 'DK', 'summer', ARRAY[6, 7, 8], 50),
('bær', 'DK', 'summer', ARRAY[6, 7, 8], 50),
('tomatoes', 'DK', 'summer', ARRAY[7, 8, 9], 45),
('tomater', 'DK', 'summer', ARRAY[7, 8, 9], 45),
('cucumber', 'DK', 'summer', ARRAY[6, 7, 8], 40),
('agurk', 'DK', 'summer', ARRAY[6, 7, 8], 40),
('grilled', 'DK', 'summer', ARRAY[6, 7, 8], 30),
('grillet', 'DK', 'summer', ARRAY[6, 7, 8], 30),
('salad', 'DK', 'summer', ARRAY[6, 7, 8], 35),
('salat', 'DK', 'summer', ARRAY[6, 7, 8], 35),
('ice cream', 'DK', 'summer', ARRAY[6, 7, 8], 45),
('is', 'DK', 'summer', ARRAY[6, 7, 8], 45),
('sorbet', 'DK', 'summer', ARRAY[6, 7, 8], 45),
('cold soup', 'DK', 'summer', ARRAY[6, 7, 8], 40),
('kold suppe', 'DK', 'summer', ARRAY[6, 7, 8], 40),

-- Autumn (September-November)
('mushrooms', 'DK', 'autumn', ARRAY[9, 10, 11], 50),
('svampe', 'DK', 'autumn', ARRAY[9, 10, 11], 50),
('root vegetables', 'DK', 'autumn', ARRAY[9, 10, 11], 40),
('rodfrugter', 'DK', 'autumn', ARRAY[9, 10, 11], 40),
('game', 'DK', 'autumn', ARRAY[9, 10, 11], 45),
('vildt', 'DK', 'autumn', ARRAY[9, 10, 11], 45),
('venison', 'DK', 'autumn', ARRAY[9, 10, 11], 45),
('rådyr', 'DK', 'autumn', ARRAY[9, 10, 11], 45),
('duck', 'DK', 'autumn', ARRAY[9, 10, 11], 45),
('and', 'DK', 'autumn', ARRAY[9, 10, 11], 45),
('pumpkin', 'DK', 'autumn', ARRAY[9, 10, 11], 45),
('græskar', 'DK', 'autumn', ARRAY[9, 10, 11], 45),
('squash', 'DK', 'autumn', ARRAY[9, 10, 11], 45),
('apples', 'DK', 'autumn', ARRAY[9, 10, 11], 40),
('æbler', 'DK', 'autumn', ARRAY[9, 10, 11], 40),
('pears', 'DK', 'autumn', ARRAY[9, 10, 11], 40),
('pærer', 'DK', 'autumn', ARRAY[9, 10, 11], 40),

-- Winter (December-February)
('kale', 'DK', 'winter', ARRAY[12, 1, 2], 45),
('grønkål', 'DK', 'winter', ARRAY[12, 1, 2], 45),
('cabbage', 'DK', 'winter', ARRAY[12, 1, 2], 40),
('kål', 'DK', 'winter', ARRAY[12, 1, 2], 40),
('stew', 'DK', 'winter', ARRAY[12, 1, 2], 50),
('gryde', 'DK', 'winter', ARRAY[12, 1, 2], 50),
('braised', 'DK', 'winter', ARRAY[12, 1, 2], 50),
('braiseret', 'DK', 'winter', ARRAY[12, 1, 2], 50),
('root vegetables', 'DK', 'winter', ARRAY[12, 1, 2], 40),
('comfort', 'DK', 'winter', ARRAY[12, 1, 2], 45),
('citrus', 'DK', 'winter', ARRAY[12, 1, 2], 40),
('citrusfrugter', 'DK', 'winter', ARRAY[12, 1, 2], 40)
ON CONFLICT (ingredient_name, country_code, season) DO NOTHING;

-- =====================================================
-- OPPORTUNITY TRACKING
-- =====================================================
-- Track when specific opportunities were last triggered

CREATE TABLE IF NOT EXISTS opportunity_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Opportunity identification
  opportunity_type TEXT NOT NULL, -- 'terrace_opening', 'team_spotlight', 'event_announcement', etc.
  opportunity_subtype TEXT, -- Optional: 'chef_spotlight', 'server_spotlight'
  
  -- Timing
  last_triggered_date TIMESTAMPTZ NOT NULL,
  last_posted_date TIMESTAMPTZ, -- When post actually went live
  
  -- Tracking
  times_triggered INTEGER DEFAULT 1,
  times_posted INTEGER DEFAULT 0,
  
  -- Context
  context JSONB, -- Store any relevant context (team member name, event details, etc.)
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(business_id, opportunity_type, opportunity_subtype)
);

-- Indexes
CREATE INDEX idx_opportunity_tracking_business ON opportunity_tracking(business_id);
CREATE INDEX idx_opportunity_tracking_type ON opportunity_tracking(opportunity_type);
CREATE INDEX idx_opportunity_tracking_last_posted ON opportunity_tracking(last_posted_date);

CREATE TRIGGER update_opportunity_tracking_updated_at
  BEFORE UPDATE ON opportunity_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to update menu item metadata after posting
CREATE OR REPLACE FUNCTION update_menu_item_posted(
  p_business_id UUID,
  p_item_name TEXT,
  p_engagement_rate DECIMAL DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE menu_item_metadata
  SET 
    last_posted_date = NOW(),
    total_times_posted = total_times_posted + 1,
    last_engagement_rate = COALESCE(p_engagement_rate, last_engagement_rate),
    avg_engagement_rate = CASE 
      WHEN p_engagement_rate IS NOT NULL THEN
        ((avg_engagement_rate * total_times_posted) + p_engagement_rate) / (total_times_posted + 1)
      ELSE avg_engagement_rate
    END
  WHERE business_id = p_business_id
    AND item_name = p_item_name;
  
  -- If no row exists, create one
  IF NOT FOUND THEN
    INSERT INTO menu_item_metadata (business_id, item_name, last_posted_date, total_times_posted, last_engagement_rate)
    VALUES (p_business_id, p_item_name, NOW(), 1, p_engagement_rate);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to track opportunity trigger
CREATE OR REPLACE FUNCTION track_opportunity_trigger(
  p_business_id UUID,
  p_opportunity_type TEXT,
  p_opportunity_subtype TEXT DEFAULT NULL,
  p_context JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO opportunity_tracking (
    business_id,
    opportunity_type,
    opportunity_subtype,
    last_triggered_date,
    context
  )
  VALUES (
    p_business_id,
    p_opportunity_type,
    p_opportunity_subtype,
    NOW(),
    p_context
  )
  ON CONFLICT (business_id, opportunity_type, opportunity_subtype)
  DO UPDATE SET
    last_triggered_date = NOW(),
    times_triggered = opportunity_tracking.times_triggered + 1,
    context = COALESCE(p_context, opportunity_tracking.context);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE menu_item_metadata IS 'Metadata for menu items to enable opportunity scoring (Layer 5)';
COMMENT ON TABLE seasonal_ingredients IS 'Seasonal ingredient database for bonus scoring - expandable by country';
COMMENT ON TABLE opportunity_tracking IS 'Tracks when opportunities were triggered/posted to prevent repetition';
COMMENT ON FUNCTION update_menu_item_posted IS 'Call after posting menu item to update recency and performance data';
COMMENT ON FUNCTION track_opportunity_trigger IS 'Call when opportunity is triggered (terrace opening, team spotlight, etc.)';

COMMENT ON COLUMN menu_item_metadata.is_signature IS 'Signature/famous dish - gets base score of 100';
COMMENT ON COLUMN menu_item_metadata.is_seasonal IS 'Seasonal special - gets base score of 75';
COMMENT ON COLUMN menu_item_metadata.is_limited_time IS 'Limited time offer - gets base score of 85';
COMMENT ON COLUMN menu_item_metadata.dish_temp_category IS 'Temperature classification for weather matching (cold/hot/warm/neutral)';
COMMENT ON COLUMN menu_item_metadata.last_posted_date IS 'Last time featured in post - used for recency penalty';
COMMENT ON COLUMN menu_item_metadata.seasonal_ingredients IS 'Array of seasonal ingredients for bonus scoring';
