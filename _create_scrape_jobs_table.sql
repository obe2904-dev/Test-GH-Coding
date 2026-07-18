-- Create scrape_jobs table for async menu enrichment
-- This table stores background jobs for crawling menu pages after initial scrape

CREATE TABLE IF NOT EXISTS scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('menu_enrichment', 'additional_pages')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  result JSONB
);

-- Index for efficient job queue queries
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status_created 
  ON scrape_jobs(status, created_at) 
  WHERE status IN ('pending', 'processing');

-- Index for business lookup
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_business 
  ON scrape_jobs(business_id);

COMMENT ON TABLE scrape_jobs IS 'Background job queue for menu enrichment and additional page crawling';
COMMENT ON COLUMN scrape_jobs.job_type IS 'Type of scraping job: menu_enrichment for menu page extraction, additional_pages for other enrichment';
COMMENT ON COLUMN scrape_jobs.status IS 'Job status: pending (not started), processing (in progress), completed (success), failed (error)';
COMMENT ON COLUMN scrape_jobs.result IS 'JSON payload with extracted data (menu_highlights, etc.)';
