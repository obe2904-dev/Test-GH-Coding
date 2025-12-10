-- Add extracted_json column to business_documents table
-- Run this in Supabase SQL Editor

ALTER TABLE business_documents 
ADD COLUMN IF NOT EXISTS extracted_json JSONB;

-- Create GIN index for fast JSON queries
CREATE INDEX IF NOT EXISTS idx_business_documents_json 
ON business_documents USING GIN (extracted_json);

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'business_documents' 
AND column_name = 'extracted_json';
