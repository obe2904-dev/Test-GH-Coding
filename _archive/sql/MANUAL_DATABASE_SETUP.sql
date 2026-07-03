-- =====================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- Dashboard → SQL Editor → New Query → Paste & Run
-- =====================================================
-- This script checks if businesses table exists first,
-- and creates it if needed before creating business_documents
-- =====================================================

-- 1. Create businesses table if it doesn't exist (from migration 002)
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vertical TEXT NOT NULL,
  website_url TEXT,
  normalized_url TEXT UNIQUE, -- Normalized URL for AI identification (unique business identifier)
  primary_language TEXT DEFAULT 'da',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id)
);

-- Create index for normalized_url lookups
CREATE INDEX IF NOT EXISTS idx_businesses_normalized_url ON public.businesses(normalized_url) WHERE normalized_url IS NOT NULL;

-- Enable RLS on businesses
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Create businesses RLS policies (drop first if they exist)
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view own business" ON public.businesses;
  DROP POLICY IF EXISTS "Users can insert own business" ON public.businesses;
  DROP POLICY IF EXISTS "Users can update own business" ON public.businesses;
  DROP POLICY IF EXISTS "Users can delete own business" ON public.businesses;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view own business"
  ON public.businesses
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own business"
  ON public.businesses
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own business"
  ON public.businesses
  FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own business"
  ON public.businesses
  FOR DELETE
  USING (owner_id = auth.uid());

-- 2. Create business_documents table
CREATE TABLE IF NOT EXISTS public.business_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('menu', 'wine_list', 'other')),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  extracted_text TEXT,
  extracted_json JSONB,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add extracted_json column if table already exists (migration for existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_documents' 
    AND column_name = 'extracted_json'
  ) THEN
    ALTER TABLE public.business_documents 
    ADD COLUMN extracted_json JSONB;
  END IF;
END $$;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_business_documents_business_id ON public.business_documents(business_id);
CREATE INDEX IF NOT EXISTS idx_business_documents_type ON public.business_documents(business_id, document_type);
CREATE INDEX IF NOT EXISTS idx_business_documents_json ON public.business_documents USING GIN (extracted_json);

-- 4. Enable RLS
ALTER TABLE public.business_documents ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies (drop first if they exist)
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view their own business documents" ON public.business_documents;
  DROP POLICY IF EXISTS "Users can insert documents for their businesses" ON public.business_documents;
  DROP POLICY IF EXISTS "Users can update their own business documents" ON public.business_documents;
  DROP POLICY IF EXISTS "Users can delete their own business documents" ON public.business_documents;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view their own business documents"
  ON public.business_documents
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert documents for their businesses"
  ON public.business_documents
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own business documents"
  ON public.business_documents
  FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own business documents"
  ON public.business_documents
  FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- =====================================================
-- STORAGE BUCKET - Create manually via Dashboard
-- Dashboard → Storage → Create bucket
-- =====================================================
-- Bucket name: business-documents
-- Public: Yes
-- File size limit: 50MB
-- Allowed MIME types: application/pdf

-- After creating bucket, run these policies:

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can upload documents for their businesses" ON storage.objects;
  DROP POLICY IF EXISTS "Users can view their business documents storage" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their business documents storage" ON storage.objects;
END $$;

CREATE POLICY "Users can upload documents for their businesses"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'business-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their business documents storage"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'business-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their business documents storage"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'business-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'business_documents'
) AS table_exists;

-- Check bucket exists
SELECT * FROM storage.buckets WHERE id = 'business-documents';

-- Check policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'business_documents';
