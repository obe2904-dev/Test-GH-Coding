-- Migration: Add scraped_cache table for website HTML/text caching
-- Purpose: Reduce scraping costs by caching results for 24 hours
-- Date: 2026-07-12

-- Create scraped_cache table
CREATE TABLE IF NOT EXISTS scraped_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  raw_html TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  structured_data JSONB,  -- Links, headings, JSON-LD data
  scraped_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  scraper_type TEXT DEFAULT 'vercel-playwright',  -- 'vercel-playwright', 'simple-fetch'
  
  -- Performance tracking
  scrape_duration_ms INTEGER,
  status TEXT DEFAULT 'success',  -- 'success', 'partial', 'failed'
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_scraped_cache_url ON scraped_cache(url);
CREATE INDEX IF NOT EXISTS idx_scraped_cache_scraped_at ON scraped_cache(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_cache_status ON scraped_cache(status);

-- Automatic cleanup of old cache entries (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_scraped_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM scraped_cache
  WHERE scraped_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE scraped_cache IS 'Caches scraped website content to reduce API costs. TTL: 24 hours for reads, 7 days for cleanup.';
COMMENT ON COLUMN scraped_cache.raw_html IS 'Full HTML content from page';
COMMENT ON COLUMN scraped_cache.raw_text IS 'Extracted plain text from body.innerText';
COMMENT ON COLUMN scraped_cache.structured_data IS 'JSON containing: links[], headings[], structuredData[] (JSON-LD)';
COMMENT ON COLUMN scraped_cache.scraper_type IS 'Which scraper was used: vercel-playwright (primary), simple-fetch (fallback)';

-- Verify table creation
SELECT 
  tablename, 
  schemaname 
FROM pg_tables 
WHERE tablename = 'scraped_cache';

-- Show table structure
\d scraped_cache
