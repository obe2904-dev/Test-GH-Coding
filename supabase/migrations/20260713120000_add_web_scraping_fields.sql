-- =====================================================
-- Add Web Scraping Fields
-- =====================================================
-- Purpose: Support web scraping data extraction into business tables
--
-- New Fields:
--   - takeaway_url: Link to online ordering (Wolt, Just Eat, etc.)
--   - smiley_url: Link to Danish food safety inspection report
--   - meta_tags: SEO/OG tags from website (title, description, image)
--   - last_scraped_at: Track when business website was last analyzed
-- =====================================================

-- =====================================================
-- business_profile: Add takeaway_url and meta_tags
-- =====================================================

ALTER TABLE business_profile
  ADD COLUMN IF NOT EXISTS takeaway_url text,
  ADD COLUMN IF NOT EXISTS meta_tags jsonb;

COMMENT ON COLUMN business_profile.takeaway_url IS 
  'External takeaway/delivery URL (e.g., Wolt, Just Eat, restaurant''s own ordering system)';

COMMENT ON COLUMN business_profile.meta_tags IS 
  'Website metadata extracted from scraping: {title, description, og_image, og_type, locale, etc.}';

-- =====================================================
-- business_operations: Add smiley_url
-- =====================================================

ALTER TABLE business_operations
  ADD COLUMN IF NOT EXISTS smiley_url text;

COMMENT ON COLUMN business_operations.smiley_url IS 
  'Link to Danish food safety inspection report (findsmiley.dk or smiley-rapporten.dk)';

-- =====================================================
-- businesses: Add last_scraped_at for refresh tracking
-- =====================================================

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS last_scraped_at timestamptz;

COMMENT ON COLUMN businesses.last_scraped_at IS 
  'Last time website was scraped and analyzed. Used for "Last updated 90 days ago" notifications.';

-- =====================================================
-- Index for finding stale scrapes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_businesses_last_scraped
  ON businesses(last_scraped_at)
  WHERE last_scraped_at IS NOT NULL;

-- =====================================================
-- Migration Complete
-- =====================================================
