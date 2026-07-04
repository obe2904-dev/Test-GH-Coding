-- Add extracted_json column to business_documents table
-- This stores the structured menu data parsed from the PDF text

-- Add column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'business_documents' 
    AND column_name = 'extracted_json'
  ) THEN
    ALTER TABLE business_documents 
    ADD COLUMN extracted_json JSONB;
    
    RAISE NOTICE 'Added extracted_json column';
  ELSE
    RAISE NOTICE 'extracted_json column already exists';
  END IF;
END $$;

-- Create GIN index for fast JSON queries
CREATE INDEX IF NOT EXISTS idx_business_documents_json ON business_documents USING GIN (extracted_json);

-- Add comment for documentation
COMMENT ON COLUMN business_documents.extracted_json IS 'Structured menu data extracted from PDF, containing categories and menu items with prices';
