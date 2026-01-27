-- Add crawl data fields to website_analyses for persistent storage
-- This allows Brand Profile Generator to use pre-crawled data

DO $$
BEGIN
  IF to_regclass('public.website_analyses') IS NULL THEN
    RAISE NOTICE 'Skipping: table public.website_analyses does not exist yet';
    RETURN;
  END IF;

  -- Homepage content (clean text for AI processing)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'website_analyses' AND column_name = 'homepage_content') THEN
    ALTER TABLE public.website_analyses ADD COLUMN homepage_content TEXT;
  END IF;

  -- About page content (if crawled)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'website_analyses' AND column_name = 'about_content') THEN
    ALTER TABLE public.website_analyses ADD COLUMN about_content TEXT;
  END IF;

  -- Detected links (menu, booking, contact URLs)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'website_analyses' AND column_name = 'detected_links') THEN
    ALTER TABLE public.website_analyses ADD COLUMN detected_links JSONB;
  END IF;

  -- Extracted about block (pre-AI short description candidate)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'website_analyses' AND column_name = 'about_block') THEN
    ALTER TABLE public.website_analyses ADD COLUMN about_block TEXT;
  END IF;

  -- Extracted keywords
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'website_analyses' AND column_name = 'keywords') THEN
    ALTER TABLE public.website_analyses ADD COLUMN keywords TEXT[];
  END IF;

  -- Menu structure (JSONB)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'website_analyses' AND column_name = 'menu_structure') THEN
    ALTER TABLE public.website_analyses ADD COLUMN menu_structure JSONB;
  END IF;

  -- Add comments
  COMMENT ON COLUMN public.website_analyses.homepage_content IS 'Clean text extracted from homepage for AI processing';
  COMMENT ON COLUMN public.website_analyses.about_content IS 'Clean text from About page if crawled';
  COMMENT ON COLUMN public.website_analyses.detected_links IS 'Detected URLs: {menu_urls:[], booking_url:"", contact_url:""}';
  COMMENT ON COLUMN public.website_analyses.about_block IS 'Pre-extracted about/welcome text from homepage';
  COMMENT ON COLUMN public.website_analyses.keywords IS 'AI-extracted keywords about the business';
  COMMENT ON COLUMN public.website_analyses.menu_structure IS 'Structured menu data: [{name, timeRange, items}]';

END $$;

-- Add menu_structure column to business_profile if not exists
DO $$
BEGIN
  IF to_regclass('public.business_profile') IS NULL THEN
    RAISE NOTICE 'Skipping: table public.business_profile does not exist yet';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'business_profile' AND column_name = 'menu_structure') THEN
    ALTER TABLE public.business_profile ADD COLUMN menu_structure JSONB;
    COMMENT ON COLUMN public.business_profile.menu_structure IS 'Structured menu data from website analysis';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'business_profile' AND column_name = 'keywords') THEN
    ALTER TABLE public.business_profile ADD COLUMN keywords TEXT[];
    COMMENT ON COLUMN public.business_profile.keywords IS 'Business keywords for content generation';
  END IF;

END $$;
