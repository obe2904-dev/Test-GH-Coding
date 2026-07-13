-- =====================================================
-- Website Scrape Results Table
-- =====================================================
-- Purpose: Separate scraping (expensive) from AI extraction (cheap)
--
-- Architecture:
--   Step 1: Cloud Run scrapes website → store payload here
--   Step 2: AI extracts from stored payload → update extracted_data
--
-- Benefits:
--   - Re-run AI extraction without re-scraping (prompt improvements, model upgrades)
--   - Debug AI issues by inspecting the exact payload it received
--   - Track scraping vs extraction costs independently
--   - Historical record of website changes over time
--   - Enable batch re-extraction, A/B testing, multi-model comparison
-- =====================================================

CREATE TABLE website_scrape_results (
  -- Identity
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  url             text NOT NULL,
  url_normalized  text GENERATED ALWAYS AS (
    lower(trim(trailing '/' from url))
  ) STORED,
  
  -- Scraping metadata
  scraped_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,  -- when to re-scrape (e.g., scraped_at + 30 days)
  force_refresh   boolean DEFAULT false,
  scraper_version text,  -- 'cloud-run-v2', 'scraper-00013-7ss'
  scraper_metadata jsonb,  -- {duration_ms, revision, error_count, etc.}
  
  -- Quality signals (promoted from JSON for fast querying)
  content_quality text CHECK (content_quality IN ('rich', 'thin', 'shell')),
  menu_source     text CHECK (menu_source IN ('inline', 'link', 'pdf', 'none')),
  content_char_count int,
  raw_size_bytes  int,
  
  -- Full scraped payload (source of truth)
  payload         jsonb NOT NULL,
  
  -- AI extraction metadata
  extracted_at    timestamptz,
  extracted_data  jsonb,  -- structured brand/menu fields from AI
  extraction_model text,  -- 'gemini-2.5-flash', 'gpt-4o-mini' (audit trail)
  extraction_prompt_version text,  -- 'v3', 'v4' (for targeted re-runs)
  extraction_attempts int DEFAULT 0,
  extraction_errors jsonb[],  -- [{timestamp, error, model}, ...]
  last_extraction_error text,
  
  -- Audit
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- Indexes
-- =====================================================

-- Primary lookup: get latest scrape for a business
CREATE INDEX idx_scrape_results_business_scraped 
  ON website_scrape_results(business_id, scraped_at DESC);

-- Find stale scrapes that need refresh
CREATE INDEX idx_scrape_results_expires 
  ON website_scrape_results(expires_at) 
  WHERE expires_at IS NOT NULL;

-- Query by quality signals (find shell sites, inline menus, etc.)
CREATE INDEX idx_scrape_results_quality 
  ON website_scrape_results(content_quality, menu_source);

-- Find scrapes pending extraction
CREATE INDEX idx_scrape_results_pending_extraction 
  ON website_scrape_results(scraped_at) 
  WHERE extracted_at IS NULL;

-- Find scrapes by extraction version (for batch re-runs)
CREATE INDEX idx_scrape_results_extraction_version 
  ON website_scrape_results(extraction_prompt_version) 
  WHERE extraction_prompt_version IS NOT NULL;

-- Lookup by business + URL (for checking existing scrapes)
CREATE INDEX idx_scrape_results_business_url 
  ON website_scrape_results(business_id, url_normalized, scraped_at DESC);

-- =====================================================
-- Triggers
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_website_scrape_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER website_scrape_results_updated_at
  BEFORE UPDATE ON website_scrape_results
  FOR EACH ROW
  EXECUTE FUNCTION update_website_scrape_results_updated_at();

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE website_scrape_results ENABLE ROW LEVEL SECURITY;

-- Users can read scrape results for their own businesses
CREATE POLICY "Users can read their business scrape results"
  ON website_scrape_results
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses 
      WHERE owner_id = auth.uid()
    )
  );

-- Service role can do everything (for Edge Functions)
CREATE POLICY "Service role has full access"
  ON website_scrape_results
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- Helper Functions
-- =====================================================

-- Get latest scrape for a business
CREATE OR REPLACE FUNCTION get_latest_scrape(p_business_id uuid, p_url text DEFAULT NULL)
RETURNS SETOF website_scrape_results AS $$
BEGIN
  IF p_url IS NOT NULL THEN
    RETURN QUERY
    SELECT * FROM website_scrape_results
    WHERE business_id = p_business_id
      AND url_normalized = lower(trim(trailing '/' from p_url))
    ORDER BY scraped_at DESC
    LIMIT 1;
  ELSE
    RETURN QUERY
    SELECT * FROM website_scrape_results
    WHERE business_id = p_business_id
    ORDER BY scraped_at DESC
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Mark scrape for re-extraction (useful when updating prompts)
CREATE OR REPLACE FUNCTION mark_for_reextraction(
  p_extraction_prompt_version text DEFAULT NULL,
  p_content_quality text DEFAULT NULL
)
RETURNS int AS $$
DECLARE
  affected_count int;
BEGIN
  UPDATE website_scrape_results
  SET 
    extracted_at = NULL,
    extracted_data = NULL,
    last_extraction_error = NULL
  WHERE 
    extracted_at IS NOT NULL
    AND (p_extraction_prompt_version IS NULL OR extraction_prompt_version = p_extraction_prompt_version)
    AND (p_content_quality IS NULL OR content_quality = p_content_quality);
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE website_scrape_results IS 
  'Stores scraped website data and AI extraction results. Separates expensive scraping from cheap AI extraction to enable prompt iteration and debugging.';

COMMENT ON COLUMN website_scrape_results.payload IS 
  'Full ScrapedPayload from Cloud Run v2. Source of truth for AI extraction.';

COMMENT ON COLUMN website_scrape_results.extracted_data IS 
  'AI-extracted structured data (about, description, venue_hooks, keywords, tone_of_voice, etc.)';

COMMENT ON COLUMN website_scrape_results.content_quality IS 
  'Promoted from payload for fast querying: rich (>2000 chars), thin (200-2000), shell (<200)';

COMMENT ON COLUMN website_scrape_results.extraction_prompt_version IS 
  'Track prompt version to enable targeted re-extraction when prompts improve';

COMMENT ON FUNCTION get_latest_scrape(uuid, text) IS 
  'Get the most recent scrape for a business, optionally filtered by URL';

COMMENT ON FUNCTION mark_for_reextraction(text, text) IS 
  'Clear extraction data to trigger re-extraction. Useful after prompt improvements.';
