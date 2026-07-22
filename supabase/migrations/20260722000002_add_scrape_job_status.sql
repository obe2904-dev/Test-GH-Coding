-- Async scrape job lifecycle on website_scrape_results
ALTER TABLE website_scrape_results
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS extraction_status text
    CHECK (extraction_status IN ('pending', 'running', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS extraction_summary jsonb,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Existing rows are historical completed scrapes; default 'completed' covers them.

CREATE INDEX IF NOT EXISTS idx_wsr_business_status
  ON website_scrape_results (business_id, status, scraped_at DESC);

-- RLS policy: ensure users can read their business scrape results
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'website_scrape_results' AND policyname = 'owner_select_scrapes'
  ) THEN
    CREATE POLICY owner_select_scrapes ON website_scrape_results
      FOR SELECT USING (
        business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
      );
  END IF;
END $$;
