-- Create menu_extractions table to store extracted menu data per source
-- Each menu source can have its own category/item structure independently

CREATE TABLE IF NOT EXISTS menu_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  menu_source_id UUID REFERENCES menu_sources(id) ON DELETE SET NULL,
  menu_name TEXT NOT NULL, -- "Julefrokost", "Brunch", "Standard", etc. (editable by user)
  menu_type TEXT NOT NULL DEFAULT 'standard' CHECK (menu_type IN ('standard', 'special')),
  extracted_data JSONB NOT NULL, -- { categories: [{ id, name, items: [...] }] }
  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create index for fast lookups by business_id
CREATE INDEX idx_menu_extractions_business_id ON menu_extractions(business_id);
CREATE INDEX idx_menu_extractions_business_type ON menu_extractions(business_id, menu_type);
CREATE INDEX idx_menu_extractions_source ON menu_extractions(menu_source_id);

-- Add RLS policies
ALTER TABLE menu_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own business menu extractions"
  ON menu_extractions FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert menu extractions for their business"
  ON menu_extractions FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    ) AND
    created_by = auth.uid()
  );

CREATE POLICY "Users can update their own business menu extractions"
  ON menu_extractions FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own business menu extractions"
  ON menu_extractions FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE menu_extractions IS 'Stores extracted menu data per source (categories and items)';
COMMENT ON COLUMN menu_extractions.menu_name IS 'User-editable name for the menu (e.g., "Julefrokost", "Brunch")';
COMMENT ON COLUMN menu_extractions.menu_type IS 'Menu type for grouping: standard or special';
COMMENT ON COLUMN menu_extractions.extracted_data IS 'JSON structure with categories and items';
COMMENT ON COLUMN menu_extractions.menu_source_id IS 'Reference to the source menu (link or PDF)';
