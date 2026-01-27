-- Fix / backfill website_analyses columns
--
-- Why:
-- Earlier migrations may have been marked as applied while skipping ALTER TABLE
-- (e.g., if website_analyses didn't exist at the time). This migration safely
-- ensures required columns exist now.

DO $$
BEGIN
  IF to_regclass('public.website_analyses') IS NULL THEN
    RAISE NOTICE 'Skipping 20260105120000_fix_website_analyses_columns: table public.website_analyses does not exist.';
    RETURN;
  END IF;

  ALTER TABLE public.website_analyses
    ADD COLUMN IF NOT EXISTS raw_html TEXT,
    ADD COLUMN IF NOT EXISTS cta_texts TEXT[],
    ADD COLUMN IF NOT EXISTS headers TEXT[],
    ADD COLUMN IF NOT EXISTS nav_items TEXT[],
    ADD COLUMN IF NOT EXISTS hero_texts TEXT[],
    ADD COLUMN IF NOT EXISTS homepage_content TEXT,
    ADD COLUMN IF NOT EXISTS about_content TEXT,
    ADD COLUMN IF NOT EXISTS detected_links JSONB,
    ADD COLUMN IF NOT EXISTS about_block TEXT,
    ADD COLUMN IF NOT EXISTS keywords TEXT[],
    ADD COLUMN IF NOT EXISTS menu_structure JSONB;

  COMMENT ON COLUMN public.website_analyses.raw_html IS 'Truncated raw HTML of homepage (best-effort, for debugging/rehydration)';
  COMMENT ON COLUMN public.website_analyses.cta_texts IS 'Extracted button/link CTA texts from HTML';
  COMMENT ON COLUMN public.website_analyses.headers IS 'Extracted H1/H2 texts from HTML';
  COMMENT ON COLUMN public.website_analyses.nav_items IS 'Extracted navigation item texts from HTML';
  COMMENT ON COLUMN public.website_analyses.hero_texts IS 'Extracted hero/banner text snippets from HTML';

  COMMENT ON COLUMN public.website_analyses.homepage_content IS 'Clean text extracted from homepage for AI processing';
  COMMENT ON COLUMN public.website_analyses.about_content IS 'Clean text from About page if crawled';
  COMMENT ON COLUMN public.website_analyses.detected_links IS 'Detected URLs: {menu_urls:[], booking_url:"", contact_url:""}';
  COMMENT ON COLUMN public.website_analyses.about_block IS 'Pre-extracted about/welcome text from homepage';
  COMMENT ON COLUMN public.website_analyses.keywords IS 'AI-extracted keywords about the business';
  COMMENT ON COLUMN public.website_analyses.menu_structure IS 'Structured menu data: [{name, timeRange, items}]';
END $$;
