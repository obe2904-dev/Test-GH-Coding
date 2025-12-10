-- Create business_documents table for storing PDF metadata
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

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_business_documents_business_id ON business_documents(business_id);
CREATE INDEX IF NOT EXISTS idx_business_documents_type ON business_documents(business_id, document_type);

-- Enable RLS
ALTER TABLE business_documents ENABLE ROW LEVEL SECURITY;

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

-- Create storage bucket for business documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-documents', 'business-documents', true)
ON CONFLICT (id) DO NOTHING;

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
