-- Post ideas table
CREATE TABLE IF NOT EXISTS post_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Post content
  caption TEXT NOT NULL,
  hashtags TEXT[] DEFAULT ARRAY[]::TEXT[],
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'both')),
  
  -- Scheduling
  suggested_post_time TIMESTAMPTZ,
  actual_post_time TIMESTAMPTZ,
  
  -- Goal alignment
  aligned_goal_id UUID REFERENCES business_goals(id) ON DELETE SET NULL,
  goal_description TEXT,
  
  -- Content suggestions
  content_type TEXT, -- e.g., 'signature_dish', 'location_highlight', 'slow_period_promo'
  visual_suggestions JSONB, -- Photography tips, composition ideas
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'scheduled', 'posted', 'rejected')),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  posted_at TIMESTAMPTZ,
  
  -- Performance (for future analytics)
  reach INTEGER,
  engagement INTEGER,
  clicks INTEGER
);

-- Indexes
CREATE INDEX idx_post_ideas_business_id ON post_ideas(business_id);
CREATE INDEX idx_post_ideas_status ON post_ideas(status);
CREATE INDEX idx_post_ideas_suggested_time ON post_ideas(suggested_post_time);
CREATE INDEX idx_post_ideas_goal_id ON post_ideas(aligned_goal_id);

-- RLS policies
ALTER TABLE post_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their business post ideas"
ON post_ideas FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their business post ideas"
ON post_ideas FOR INSERT
TO authenticated
WITH CHECK (
  business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Users can update their business post ideas"
ON post_ideas FOR UPDATE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their business post ideas"
ON post_ideas FOR DELETE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  )
);

-- Auto-update updated_at
CREATE TRIGGER update_post_ideas_updated_at
  BEFORE UPDATE ON post_ideas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE post_ideas IS 
'AI-generated social media post ideas aligned with business goals';
