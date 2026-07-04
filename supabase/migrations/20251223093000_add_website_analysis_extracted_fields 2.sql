-- Add extracted UI text fields to website_analyses for robust CTA/header extraction
-- These fields make it possible to generate concrete MUST-USE PHRASES (e.g. "Book bord", "Se menukort")

DO $$
BEGIN
  IF to_regclass('public.website_analyses') IS NULL THEN
    RAISE NOTICE 'Skipping 20251223093000_add_website_analysis_extracted_fields: table public.website_analyses does not exist yet (apply base schema migrations first).';
    RETURN;
  END IF;

  ALTER TABLE public.website_analyses
    ADD COLUMN IF NOT EXISTS raw_html TEXT,
    ADD COLUMN IF NOT EXISTS cta_texts TEXT[],
    ADD COLUMN IF NOT EXISTS headers TEXT[],
    ADD COLUMN IF NOT EXISTS nav_items TEXT[],
    ADD COLUMN IF NOT EXISTS hero_texts TEXT[];

  COMMENT ON COLUMN public.website_analyses.raw_html IS 'Truncated raw HTML of homepage (best-effort, for debugging/rehydration)';
  COMMENT ON COLUMN public.website_analyses.cta_texts IS 'Extracted button/link CTA texts from HTML';
  COMMENT ON COLUMN public.website_analyses.headers IS 'Extracted H1/H2 texts from HTML';
  COMMENT ON COLUMN public.website_analyses.nav_items IS 'Extracted navigation item texts from HTML';
  COMMENT ON COLUMN public.website_analyses.hero_texts IS 'Extracted hero/banner text snippets from HTML';
END $$;
