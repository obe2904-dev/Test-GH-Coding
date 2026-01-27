-- Migration: Add third_party_evidence table
-- Date: 2026-01-06
-- Purpose: Store Google Maps and Instagram evidence for brand profile generation

-- Create third_party_evidence table
CREATE TABLE IF NOT EXISTS third_party_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Google Maps data
  google_maps_data JSONB,
  -- Structure: {
  --   photos: [{ url, labels, uploaded_by: 'owner'|'customer' }],
  --   reviews: [{ text, rating, recurring_terms }]
  -- }
  
  -- Instagram data (business-owned only)
  instagram_data JSONB,
  -- Structure: {
  --   businessPosts: [{ caption, image_labels, post_date }]
  -- }
  
  -- Metadata
  source_type TEXT CHECK (source_type IN ('google_maps', 'instagram', 'combined')),
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT third_party_evidence_business_unique UNIQUE (business_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_third_party_evidence_business_id 
  ON third_party_evidence(business_id);
  
CREATE INDEX IF NOT EXISTS idx_third_party_evidence_updated_at 
  ON third_party_evidence(updated_at DESC);

-- Add RLS policies
ALTER TABLE third_party_evidence ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own business's third-party evidence
CREATE POLICY "Users can view their business third-party evidence"
  ON third_party_evidence
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Only service role can insert/update third-party evidence
CREATE POLICY "Service role can insert third-party evidence"
  ON third_party_evidence
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update third-party evidence"
  ON third_party_evidence
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- Add helpful comments
COMMENT ON TABLE third_party_evidence IS 
'Read-only third-party evidence from Google Maps and Instagram. Used to confirm interior visuals and recurring guest descriptors. Lower priority than first-party data. Never used for sentiment inflation.';

COMMENT ON COLUMN third_party_evidence.google_maps_data IS 
'Google Maps photos (owner/customer) and recurring review patterns (3+ mentions). Used for visual confirmation and identifying strong repeated descriptors.';

COMMENT ON COLUMN third_party_evidence.instagram_data IS 
'Business-owned Instagram content only (no customer posts). Used to confirm visual style and messaging patterns.';
