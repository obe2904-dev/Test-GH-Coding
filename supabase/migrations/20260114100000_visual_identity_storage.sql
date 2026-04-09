-- Create storage bucket for visual identity photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('visual-identity', 'visual-identity', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for visual-identity bucket
-- Users can upload to their own business folder
CREATE POLICY "Users can upload to their business folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'visual-identity' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM businesses WHERE owner_id = auth.uid()
  )
);

-- Users can read their own business photos
CREATE POLICY "Users can read their business photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'visual-identity' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM businesses WHERE owner_id = auth.uid()
  )
);

-- Users can delete their own business photos
CREATE POLICY "Users can delete their business photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'visual-identity' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM businesses WHERE owner_id = auth.uid()
  )
);

COMMENT ON POLICY "Users can upload to their business folder" ON storage.objects IS 
'Allow authenticated users to upload photos to their business folder in visual-identity bucket';

-- Allow authenticated users to see that buckets exist (required for Storage API bucket lookup)
CREATE POLICY "Authenticated users can read buckets"
ON storage.buckets FOR SELECT
TO authenticated
USING (true);
