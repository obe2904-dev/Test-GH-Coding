-- Enable RLS on concept fit tables
ALTER TABLE business_concept_fit ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_concept_fit_multi ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read concept fit for their own businesses
CREATE POLICY "Users can read their business concept fit"
  ON business_concept_fit
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses
      WHERE owner_id = auth.uid()
    )
  );

-- Policy: Users can insert/update concept fit for their own businesses
CREATE POLICY "Users can insert their business concept fit"
  ON business_concept_fit
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their business concept fit"
  ON business_concept_fit
  FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their business concept fit"
  ON business_concept_fit
  FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses
      WHERE owner_id = auth.uid()
    )
  );

-- Policies for multi table
CREATE POLICY "Users can read their business concept fit multi"
  ON business_concept_fit_multi
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their business concept fit multi"
  ON business_concept_fit_multi
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their business concept fit multi"
  ON business_concept_fit_multi
  FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their business concept fit multi"
  ON business_concept_fit_multi
  FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses
      WHERE owner_id = auth.uid()
    )
  );

-- Service role bypass (for edge functions)
CREATE POLICY "Service role has full access to concept fit"
  ON business_concept_fit
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to concept fit multi"
  ON business_concept_fit_multi
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
