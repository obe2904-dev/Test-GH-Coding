-- Storage bucket for post photos
-- Run this in the Supabase SQL editor.
-- All statements are idempotent.

-- 1. Create (or repair) the bucket — public so getPublicUrl() works without signing
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-media',
  'post-media',
  true,
  52428800,           -- 50 MB max per file
  ARRAY['image/*']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Authenticated users may upload to any path inside the bucket
DROP POLICY IF EXISTS "post-media: authenticated insert" ON storage.objects;
CREATE POLICY "post-media: authenticated insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'post-media');

-- 3. Anyone (including anon) may read — needed for <img src="...publicUrl"> to work
DROP POLICY IF EXISTS "post-media: public select" ON storage.objects;
CREATE POLICY "post-media: public select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'post-media');

-- 4. Owners may delete their own files
DROP POLICY IF EXISTS "post-media: owner delete" ON storage.objects;
CREATE POLICY "post-media: owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'post-media' AND owner = auth.uid());
