-- Add RLS policies for opening_hours table
-- Allows users to read opening_hours for businesses they own

-- Enable RLS if not already enabled
ALTER TABLE opening_hours ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read opening_hours for their own businesses
CREATE POLICY "Users can read their business opening hours"
  ON opening_hours
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Policy: Users can insert opening_hours for their own businesses
CREATE POLICY "Users can insert their business opening hours"
  ON opening_hours
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Policy: Users can update opening_hours for their own businesses
CREATE POLICY "Users can update their business opening hours"
  ON opening_hours
  FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Policy: Users can delete opening_hours for their own businesses
CREATE POLICY "Users can delete their business opening hours"
  ON opening_hours
  FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Policy: Service role can do everything (for edge functions)
CREATE POLICY "Service role has full access"
  ON opening_hours
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE opening_hours IS 'Structured weekly hours with RLS policies for user access';
