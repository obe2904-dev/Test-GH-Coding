-- =====================================================
-- Create Website Scrapes Storage Bucket
-- =====================================================
-- Purpose: Store compressed raw HTML from website scraping
-- Run in Supabase Dashboard > SQL Editor for project oadwluspjlsnxhgakral
-- URL: https://supabase.com/dashboard/project/oadwluspjlsnxhgakral/sql/new
-- =====================================================

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'website-scrapes',
  'website-scrapes',
  false,               -- Private: only service role can access
  10485760,            -- 10 MB max per file (compressed HTML)
  ARRAY['text/html', 'application/gzip', 'application/x-gzip']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Policy: Service role can insert (Cloud Run scraper)
DROP POLICY IF EXISTS "website-scrapes: service insert" ON storage.objects;
CREATE POLICY "website-scrapes: service insert"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'website-scrapes');

-- 3. Policy: Service role can read (for reprocessing)
DROP POLICY IF EXISTS "website-scrapes: service select" ON storage.objects;
CREATE POLICY "website-scrapes: service select"
  ON storage.objects FOR SELECT
  TO service_role
  USING (bucket_id = 'website-scrapes');

-- 4. Policy: Service role can delete expired scrapes
DROP POLICY IF EXISTS "website-scrapes: service delete" ON storage.objects;
CREATE POLICY "website-scrapes: service delete"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'website-scrapes');

-- After running this, verify bucket exists:
-- https://supabase.com/dashboard/project/oadwluspjlsnxhgakral/storage/buckets

-- Expected bucket structure:
-- website-scrapes/
--   {business_id}/
--     {scrape_id}/
--       homepage.html.gz
--       menu.html.gz
--       contact.html.gz
--       ...
