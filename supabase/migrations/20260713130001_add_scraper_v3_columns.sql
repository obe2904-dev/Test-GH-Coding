-- =====================================================
-- Add Scraper V3 Columns
-- =====================================================
-- Purpose: Support v3 scraper with normalized URL and version tracking
-- =====================================================

-- Add normalized_url and scraper_version columns
ALTER TABLE website_scrape_results
  ADD COLUMN IF NOT EXISTS normalized_url text,
  ADD COLUMN IF NOT EXISTS scraper_version text DEFAULT 'cloud-run-v2';

-- Backfill normalized_url for existing rows
UPDATE website_scrape_results
SET normalized_url = lower(trim(trailing '/' from url))
WHERE normalized_url IS NULL;

-- Create index for cache lookups
CREATE INDEX IF NOT EXISTS idx_website_scrape_cache 
  ON website_scrape_results(business_id, normalized_url, scraper_version, scraped_at DESC)
  WHERE normalized_url IS NOT NULL;

-- Add comment
COMMENT ON COLUMN website_scrape_results.normalized_url IS 
  'Normalized URL for cache matching: lowercase, trailing slash removed';

COMMENT ON COLUMN website_scrape_results.scraper_version IS 
  'Scraper version used: cloud-run-v2, cloud-run-v3, etc.';
