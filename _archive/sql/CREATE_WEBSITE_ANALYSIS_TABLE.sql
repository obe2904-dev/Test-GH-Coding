-- ============================================
-- WEBSITE ANALYSIS JOBS TABLE SETUP
-- Run this in Supabase SQL Editor
-- ============================================

-- Create jobs table
CREATE TABLE IF NOT EXISTS public.website_analysis_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  website_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'done', 'error')),
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_website_jobs_status ON website_analysis_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_website_jobs_business ON website_analysis_jobs(business_id);
CREATE INDEX IF NOT EXISTS idx_website_jobs_claimed ON website_analysis_jobs(claimed_at) WHERE status = 'processing';

-- Enable realtime for live updates (skip if already added)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE website_analysis_jobs;
  EXCEPTION
    WHEN duplicate_object THEN
      -- Table already in publication, ignore
      NULL;
  END;
END $$;

-- Create RPC function for atomic job claiming
CREATE OR REPLACE FUNCTION claim_website_analysis_job()
RETURNS SETOF website_analysis_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claimed_job website_analysis_jobs;
BEGIN
  -- Atomically claim the oldest queued job
  SELECT * INTO claimed_job
  FROM website_analysis_jobs
  WHERE status = 'queued'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If found, mark as processing
  IF claimed_job.id IS NOT NULL THEN
    UPDATE website_analysis_jobs
    SET status = 'processing',
        claimed_at = NOW()
    WHERE id = claimed_job.id;
    
    RETURN QUERY SELECT * FROM website_analysis_jobs WHERE id = claimed_job.id;
  END IF;
  
  RETURN;
END;
$$;

-- Create RPC function for requeuing stale jobs
CREATE OR REPLACE FUNCTION requeue_stale_website_jobs(max_age_minutes INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  requeued_count INT;
BEGIN
  UPDATE website_analysis_jobs
  SET status = 'queued',
      claimed_at = NULL
  WHERE status = 'processing'
    AND claimed_at < NOW() - (max_age_minutes || ' minutes')::INTERVAL;
  
  GET DIAGNOSTICS requeued_count = ROW_COUNT;
  RETURN requeued_count;
END;
$$;

-- Grant permissions (adjust as needed)
GRANT SELECT, INSERT, UPDATE ON website_analysis_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON website_analysis_jobs TO service_role;
GRANT EXECUTE ON FUNCTION claim_website_analysis_job() TO service_role;
GRANT EXECUTE ON FUNCTION requeue_stale_website_jobs(INT) TO service_role;

-- Optional: Add column to businesses table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'website_analysis'
  ) THEN
    ALTER TABLE businesses ADD COLUMN website_analysis JSONB;
  END IF;
END $$;

-- Show created objects
SELECT 'Table created: website_analysis_jobs' AS message
UNION ALL
SELECT 'Function created: claim_website_analysis_job()'
UNION ALL
SELECT 'Function created: requeue_stale_website_jobs(max_age_minutes INT)';
