-- Create brand profile generation locks table
-- Prevents concurrent generation for the same business

CREATE TABLE IF NOT EXISTS brand_profile_generation_locks (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  request_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_generation_locks_started_at 
ON brand_profile_generation_locks(started_at);

-- Add comment
COMMENT ON TABLE brand_profile_generation_locks IS 
'Single-flight lock for brand profile generation. Prevents overlapping generations for same business.';

-- RLS policies (service role bypass, but good practice)
ALTER TABLE brand_profile_generation_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage generation locks"
ON brand_profile_generation_locks
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
