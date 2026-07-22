-- =====================================================
-- Async Scraping Infrastructure
-- =====================================================
-- Purpose: Enable async website scraping with webhooks
-- Created: 2026-07-22
-- Related: _PLAN_ASYNC_SCRAPING_ARCHITECTURE.md

BEGIN;

-- =====================================================
-- 1. Create scrape_jobs table
-- =====================================================

CREATE TABLE IF NOT EXISTS scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'scraping', 'extracting', 'completed', 'failed', 'cancelled')),
  progress_percent INTEGER DEFAULT 0 
    CHECK (progress_percent >= 0 AND progress_percent <= 100),
  current_step TEXT,
  
  -- Results
  scrape_result_id UUID, -- FK constraint added later to avoid circular dependency
  error_message TEXT,
  error_details JSONB,
  
  -- Metadata
  force_refresh BOOLEAN DEFAULT false,
  callback_url TEXT, -- Optional webhook for frontend notifications
  initiated_by UUID REFERENCES auth.users(id),
  
  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ,
  
  -- Statistics
  pages_crawled INTEGER DEFAULT 0,
  duration_ms INTEGER,
  
  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  parent_job_id UUID REFERENCES scrape_jobs(id), -- For targeted re-scrapes
  scrape_type TEXT DEFAULT 'full' CHECK (scrape_type IN ('full', 'targeted_rescrape'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_business ON scrape_jobs(business_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_created ON scrape_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_business_status ON scrape_jobs(business_id, status);

-- Row-level security
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own scrape jobs
CREATE POLICY "Users can view their own scrape jobs"
  ON scrape_jobs FOR SELECT
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

-- Policy: Service role can do anything (for Edge Functions)
CREATE POLICY "Service role has full access to scrape_jobs"
  ON scrape_jobs FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 2. Add async tracking columns to website_scrape_results
-- =====================================================

ALTER TABLE website_scrape_results
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES scrape_jobs(id),
  ADD COLUMN IF NOT EXISTS webhook_status TEXT 
    CHECK (webhook_status IN ('pending', 'delivered', 'failed')),
  ADD COLUMN IF NOT EXISTS webhook_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_targeted_rescrape BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_scrape_id UUID REFERENCES website_scrape_results(id),
  ADD COLUMN IF NOT EXISTS targeted_pages TEXT[];

-- Index for job lookups
CREATE INDEX IF NOT EXISTS idx_scrape_results_job 
  ON website_scrape_results(job_id);

-- =====================================================
-- 3. Create view for job status with details
-- =====================================================

CREATE OR REPLACE VIEW scrape_job_status AS
SELECT 
  sj.id AS job_id,
  sj.business_id,
  sj.url,
  sj.status,
  sj.progress_percent,
  sj.current_step,
  sj.pages_crawled,
  sj.created_at,
  sj.started_at,
  sj.completed_at,
  sj.estimated_completion_at,
  sj.duration_ms,
  sj.error_message,
  sj.scrape_type,
  sr.id AS scrape_result_id,
  sr.content_quality,
  sr.menu_source,
  EXTRACT(EPOCH FROM (NOW() - sj.created_at)) * 1000 AS elapsed_ms
FROM scrape_jobs sj
LEFT JOIN website_scrape_results sr ON sj.scrape_result_id = sr.id
ORDER BY sj.created_at DESC;

-- =====================================================
-- 4. Create function to cleanup old jobs
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_scrape_jobs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete jobs older than 7 days (keep history for 1 week)
  DELETE FROM scrape_jobs
  WHERE created_at < NOW() - INTERVAL '7 days'
    AND status IN ('completed', 'failed', 'cancelled');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. Create function to find orphaned scrapes (webhook failed)
-- =====================================================

CREATE OR REPLACE FUNCTION find_orphaned_scrapes()
RETURNS TABLE (
  job_id UUID,
  scrape_result_id UUID,
  minutes_old INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sj.id AS job_id,
    sr.id AS scrape_result_id,
    EXTRACT(EPOCH FROM (NOW() - sr.created_at))::INTEGER / 60 AS minutes_old
  FROM scrape_jobs sj
  JOIN website_scrape_results sr ON sr.job_id = sj.id
  WHERE sj.status IN ('scraping', 'pending')
    AND sr.created_at < NOW() - INTERVAL '10 minutes'
    AND (sr.webhook_status IS NULL OR sr.webhook_status = 'pending');
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =====================================================
-- Verify Migration
-- =====================================================

SELECT 'Migration completed successfully!' AS message;
SELECT COUNT(*) AS scrape_jobs_count FROM scrape_jobs;
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'scrape_jobs' 
ORDER BY ordinal_position;
