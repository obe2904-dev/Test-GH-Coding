-- =====================================================
-- EXPAND BUSINESS TYPE CLASSIFICATION
-- =====================================================
-- Extends establishment_type to support full taxonomy
-- FSE, SBO, MFV (Food Truck), MFD (Mobile Dispenser), QSR (Quick Service)

-- Drop old constraint
ALTER TABLE business_operations 
DROP CONSTRAINT IF EXISTS establishment_type_check;

-- Expand allowed values
ALTER TABLE business_operations 
ADD CONSTRAINT establishment_type_check 
CHECK (establishment_type IS NULL OR establishment_type IN ('FSE', 'SBO', 'MFV', 'MFD', 'QSR'));

-- Update comment
COMMENT ON COLUMN business_operations.establishment_type IS 
'AI-detected business classification:
- FSE = Full-Service Establishment (restaurants with table service, multiple courses)
- SBO = Specialized Beverage Outlet (cafes, bars, limited food)
- MFV = Mobile Food Vehicle (food trucks, mobile food preparers)
- MFD = Mobile Food Dispenser (pre-packaged, vending)
- QSR = Quick Service Restaurant (fast food, counter service, limited table dining)';

-- =====================================================
-- BUSINESS TYPE POSTING FREQUENCY DEFAULTS
-- =====================================================
-- Stores default posting patterns per business type

CREATE TABLE IF NOT EXISTS business_type_defaults (
  business_type TEXT PRIMARY KEY CHECK (business_type IN ('FSE', 'SBO', 'MFV', 'MFD', 'QSR')),
  
  -- Posting frequency
  min_posts_per_week INTEGER NOT NULL,
  max_posts_per_week INTEGER NOT NULL,
  ideal_posts_per_week INTEGER NOT NULL,
  
  -- Platform priorities (0.0 - 1.0)
  instagram_weight DECIMAL(3,2) DEFAULT 0.50,
  facebook_weight DECIMAL(3,2) DEFAULT 0.50,
  
  -- Content type distribution (must sum to 1.0)
  menu_highlight_ratio DECIMAL(3,2) DEFAULT 0.30,
  location_story_ratio DECIMAL(3,2) DEFAULT 0.20,
  behind_scenes_ratio DECIMAL(3,2) DEFAULT 0.15,
  event_promotion_ratio DECIMAL(3,2) DEFAULT 0.20,
  engagement_ratio DECIMAL(3,2) DEFAULT 0.15,
  
  -- Content style defaults
  default_tone TEXT CHECK (default_tone IN ('casual', 'refined', 'playful', 'professional')),
  emoji_frequency TEXT CHECK (emoji_frequency IN ('none', 'minimal', 'moderate', 'frequent')),
  caption_length TEXT CHECK (caption_length IN ('short', 'medium', 'long')),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default values (using ON CONFLICT to make idempotent)
INSERT INTO business_type_defaults (
  business_type, 
  min_posts_per_week, 
  max_posts_per_week, 
  ideal_posts_per_week,
  instagram_weight,
  facebook_weight,
  menu_highlight_ratio,
  location_story_ratio,
  behind_scenes_ratio,
  event_promotion_ratio,
  engagement_ratio,
  default_tone,
  emoji_frequency,
  caption_length
) VALUES
  -- FSE: Full-Service Establishment
  ('FSE', 3, 5, 4, 0.50, 0.50, 0.35, 0.20, 0.15, 0.20, 0.10, 'refined', 'minimal', 'medium'),
  
  -- SBO: Specialized Beverage Outlet (Instagram-heavy)
  ('SBO', 3, 6, 4, 0.70, 0.30, 0.25, 0.25, 0.20, 0.15, 0.15, 'casual', 'moderate', 'short'),
  
  -- MFV: Mobile Food Vehicle (High frequency, location-driven)
  ('MFV', 5, 8, 6, 0.65, 0.35, 0.30, 0.35, 0.10, 0.15, 0.10, 'playful', 'frequent', 'short'),
  
  -- MFD: Mobile Food Dispenser (Lower frequency)
  ('MFD', 2, 3, 2, 0.50, 0.50, 0.40, 0.30, 0.10, 0.15, 0.05, 'professional', 'minimal', 'short'),
  
  -- QSR: Quick Service Restaurant
  ('QSR', 3, 5, 4, 0.60, 0.40, 0.40, 0.15, 0.15, 0.20, 0.10, 'casual', 'moderate', 'short')
ON CONFLICT (business_type) DO NOTHING;

-- Comments
COMMENT ON TABLE business_type_defaults IS 'Default posting patterns and content style per business type';
COMMENT ON COLUMN business_type_defaults.instagram_weight IS 'Priority weight for Instagram (0.0-1.0)';
COMMENT ON COLUMN business_type_defaults.facebook_weight IS 'Priority weight for Facebook (0.0-1.0)';
COMMENT ON COLUMN business_type_defaults.menu_highlight_ratio IS 'Ratio of posts featuring menu items';
COMMENT ON COLUMN business_type_defaults.location_story_ratio IS 'Ratio of posts about location/atmosphere';

-- Index
CREATE INDEX IF NOT EXISTS idx_business_type_defaults_type ON business_type_defaults(business_type);
