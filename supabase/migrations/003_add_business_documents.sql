-- Create business_documents table for storing PDF metadata (if not exists)
CREATE TABLE IF NOT EXISTS business_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('menu', 'wine_list', 'other')),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  extracted_text TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_business_documents_business_id ON business_documents(business_id);
CREATE INDEX IF NOT EXISTS idx_business_documents_type ON business_documents(business_id, document_type);

-- Enable RLS
ALTER TABLE business_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own business documents" ON business_documents;
DROP POLICY IF EXISTS "Users can insert documents for their businesses" ON business_documents;
DROP POLICY IF EXISTS "Users can update their own business documents" ON business_documents;
DROP POLICY IF EXISTS "Users can delete their own business documents" ON business_documents;

-- RLS policies: Users can only access their own business documents
CREATE POLICY "Users can view their own business documents"
  ON business_documents
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert documents for their businesses"
  ON business_documents
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own business documents"
  ON business_documents
  FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own business documents"
  ON business_documents
  FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Create storage bucket for business documents (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-documents', 'business-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Users can upload documents for their businesses" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their business documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their business documents" ON storage.objects;

-- Storage policies
CREATE POLICY "Users can upload documents for their businesses"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'business-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their business documents"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'business-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their business documents"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'business-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM businesses WHERE user_id = auth.uid()
    )
  );
