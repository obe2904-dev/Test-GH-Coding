-- =====================================================
-- HYBRID ARCHITECTURE: Normalized Menu Items Table
-- =====================================================
-- Purpose: Combine menu extraction JSON with metadata for efficient querying
-- Sync: Populated from menu_results_v2.structured_data + menu_item_metadata
-- Used by: Content generation, scoring, filtering

-- Create normalized menu items table
CREATE TABLE IF NOT EXISTS menu_items_normalized (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Parent references
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  menu_result_id UUID NOT NULL REFERENCES menu_results_v2(id) ON DELETE CASCADE,
  
  -- Core item data (from structured_data JSON)
  item_name TEXT NOT NULL,
  item_description TEXT,
  item_price TEXT,
  category_name TEXT NOT NULL,
  category_type TEXT NOT NULL, -- 'main', 'kids_menu', 'dessert', 'appetizer', 'sides'
  
  -- Service period tagging (inherited from parent menu)
  service_periods TEXT[] NOT NULL DEFAULT '{}',
  service_period_name TEXT,
  
  -- Menu context
  menu_title TEXT, -- 'FROKOST', 'AFTEN', 'Brunch'
  menu_url TEXT,
  
  -- Metadata (enriched from menu_item_metadata or inferred)
  is_signature BOOLEAN DEFAULT false,
  is_seasonal BOOLEAN DEFAULT false,
  is_limited_time BOOLEAN DEFAULT false,
  dish_temp_category TEXT, -- 'hot', 'cold', 'warm', 'neutral'
  seasonal_ingredients TEXT[] DEFAULT '{}',
  location_tags TEXT[] DEFAULT '{}',
  
  -- Performance tracking (from menu_item_metadata)
  total_times_posted INTEGER DEFAULT 0,
  avg_engagement_rate DECIMAL(5,2) DEFAULT 0.0,
  last_posted_date TIMESTAMPTZ,
  
  -- Sync tracking
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  source_sha256 TEXT, -- SHA of menu_results_v2 for detecting changes
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique items per menu (allow duplicates across menus)
  UNIQUE(menu_result_id, item_name, category_name)
);

-- Indexes for fast querying
CREATE INDEX idx_menu_items_normalized_business ON menu_items_normalized(business_id);
CREATE INDEX idx_menu_items_normalized_service_periods ON menu_items_normalized USING GIN(service_periods);
CREATE INDEX idx_menu_items_normalized_category_type ON menu_items_normalized(category_type);
CREATE INDEX idx_menu_items_normalized_menu_result ON menu_items_normalized(menu_result_id);
CREATE INDEX idx_menu_items_normalized_temp_category ON menu_items_normalized(dish_temp_category);
CREATE INDEX idx_menu_items_normalized_signature ON menu_items_normalized(is_signature) WHERE is_signature = true;

-- Comments for documentation
COMMENT ON TABLE menu_items_normalized IS 'Normalized menu items extracted from menu_results_v2.structured_data, enriched with metadata. Used for content generation and scoring.';
COMMENT ON COLUMN menu_items_normalized.category_type IS 'Classification of category: main (adult dishes), kids_menu (børnemenu), dessert, appetizer, sides';
COMMENT ON COLUMN menu_items_normalized.service_periods IS 'Array of service periods when item is available: brunch, lunch, dinner';
COMMENT ON COLUMN menu_items_normalized.dish_temp_category IS 'Temperature category for seasonal matching: hot, cold, warm, neutral';
COMMENT ON COLUMN menu_items_normalized.source_sha256 IS 'SHA256 hash of parent menu_results_v2 record for change detection';

-- RLS Policy (match menu_results_v2 security)
ALTER TABLE menu_items_normalized ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for authenticated users" ON menu_items_normalized
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert for service role" ON menu_items_normalized
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Allow update for service role" ON menu_items_normalized
  FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Allow delete for service role" ON menu_items_normalized
  FOR DELETE
  TO service_role
  USING (true);

-- =====================================================
-- Helper Function: Classify Category Type
-- =====================================================
CREATE OR REPLACE FUNCTION classify_category_type(category_name TEXT)
RETURNS TEXT AS $$
BEGIN
  category_name := LOWER(category_name);
  
  -- Kids menu
  IF category_name LIKE '%børnemenu%' OR category_name LIKE '%kids%' OR category_name LIKE '%children%' THEN
    RETURN 'kids_menu';
  END IF;
  
  -- Desserts
  IF category_name LIKE '%dessert%' OR category_name LIKE '%desserter%' OR category_name LIKE '%kage%' OR category_name LIKE '%cake%' THEN
    RETURN 'dessert';
  END IF;
  
  -- Appetizers
  IF category_name LIKE '%forretter%' OR category_name LIKE '%appetizer%' OR category_name LIKE '%starter%' THEN
    RETURN 'appetizer';
  END IF;
  
  -- Sides/extras
  IF category_name LIKE '%tilbehør%' OR category_name LIKE '%sides%' OR category_name LIKE '%ekstra%' OR category_name LIKE '%tilvalg%' THEN
    RETURN 'sides';
  END IF;
  
  -- Default: main course
  RETURN 'main';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION classify_category_type IS 'Automatically classify menu category type from name for filtering';

-- =====================================================
-- Stats View for Monitoring
-- =====================================================
CREATE OR REPLACE VIEW menu_items_normalized_stats AS
SELECT 
  business_id,
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE category_type = 'main') as main_items,
  COUNT(*) FILTER (WHERE category_type = 'kids_menu') as kids_items,
  COUNT(*) FILTER (WHERE category_type = 'dessert') as dessert_items,
  COUNT(*) FILTER (WHERE 'brunch' = ANY(service_periods)) as brunch_items,
  COUNT(*) FILTER (WHERE 'lunch' = ANY(service_periods)) as lunch_items,
  COUNT(*) FILTER (WHERE 'dinner' = ANY(service_periods)) as dinner_items,
  COUNT(*) FILTER (WHERE is_signature) as signature_items,
  MAX(synced_at) as last_sync
FROM menu_items_normalized
GROUP BY business_id;

COMMENT ON VIEW menu_items_normalized_stats IS 'Statistics view for monitoring normalized menu items per business';
