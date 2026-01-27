-- Allow HTML/text snapshots in the business-documents bucket (idempotent)
--
-- If you prefer to allow ANY mime type, you can instead set allowed_mime_types = NULL.

DO $$
DECLARE
  current_types text[];
  desired_types text[] := ARRAY[
    'application/pdf',
    'text/html',
    'text/plain',
    'application/octet-stream'
  ];
BEGIN
  -- Ensure bucket exists
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('business-documents', 'business-documents', true)
  ON CONFLICT (id) DO NOTHING;

  SELECT allowed_mime_types
  INTO current_types
  FROM storage.buckets
  WHERE id = 'business-documents';

  UPDATE storage.buckets
  SET allowed_mime_types = (
    SELECT ARRAY(
      SELECT DISTINCT unnest(
        COALESCE(current_types, '{}'::text[]) || desired_types
      )
    )
  )
  WHERE id = 'business-documents';
END $$;
