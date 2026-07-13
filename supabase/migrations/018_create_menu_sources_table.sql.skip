-- Create menu_sources table to track individual menu sources (URLs, PDFs)
-- Replaces the simple array storage with proper row-level tracking

CREATE TABLE IF NOT EXISTS menu_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('url', 'pdf')),
  file_name TEXT, -- For PDFs: the original filename
  menu_type TEXT NOT NULL DEFAULT 'standard' CHECK (menu_type IN ('standard', 'special')),
  source_origin TEXT NOT NULL CHECK (source_origin IN ('ai_detected', 'manual_added')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'extracting', 'extracted', 'ignored', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Ensure no duplicate URLs per business
  UNIQUE(business_id, source_url)
);

-- Create index for fast lookups by business_id
CREATE INDEX IF NOT EXISTS idx_menu_sources_business_id ON menu_sources(business_id);
CREATE INDEX IF NOT EXISTS idx_menu_sources_status ON menu_sources(business_id, status);

-- Add RLS policies
ALTER TABLE menu_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own business menu sources" ON menu_sources;
CREATE POLICY "Users can view their own business menu sources"
  ON menu_sources FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert menu sources for their business" ON menu_sources;
CREATE POLICY "Users can insert menu sources for their business"
  ON menu_sources FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    ) AND
    created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update their own business menu sources" ON menu_sources;
CREATE POLICY "Users can update their own business menu sources"
  ON menu_sources FOR UPDATE
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

DROP POLICY IF EXISTS "Users can delete their own business menu sources" ON menu_sources;
CREATE POLICY "Users can delete their own business menu sources"
  ON menu_sources FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

COMMENT ON TABLE menu_sources IS 'Tracks individual menu sources (URLs, uploaded PDFs) for each business. Used for menu extraction workflows.';
COMMENT ON COLUMN menu_sources.source_url IS 'The URL link or file path/identifier for PDF sources';
COMMENT ON COLUMN menu_sources.source_type IS 'Type of source: url (web link) or pdf (uploaded file)';
COMMENT ON COLUMN menu_sources.file_name IS 'Original filename for PDF uploads';
COMMENT ON COLUMN menu_sources.menu_type IS 'Menu classification: standard (main menu) or special (temporary/seasonal)';
COMMENT ON COLUMN menu_sources.source_origin IS 'How the source was added: ai_detected (AI found on website) or manual_added (user added)';
COMMENT ON COLUMN menu_sources.status IS 'Current extraction status: pending, extracting, extracted, ignored, error';
COMMENT ON COLUMN menu_sources.created_at IS 'Timestamp when source was added';
COMMENT ON COLUMN menu_sources.updated_at IS 'Timestamp of last update (menu type change, status change, etc)';
