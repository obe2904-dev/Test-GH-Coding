-- Add error_code column to menu_results_v2 for machine-readable error classification
ALTER TABLE menu_results_v2 
ADD COLUMN IF NOT EXISTS error_code TEXT;

-- Create index for error analysis
CREATE INDEX IF NOT EXISTS idx_menu_results_v2_error_code 
  ON menu_results_v2(error_code) 
  WHERE error_code IS NOT NULL;

-- Add comment
COMMENT ON COLUMN menu_results_v2.error_code IS 'Machine-readable error classification (invalid_output, no_menu_found, parser_failed, etc.)';

-- Add constraint for known error codes
ALTER TABLE menu_results_v2 
ADD CONSTRAINT menu_results_v2_error_code_check 
  CHECK (error_code IS NULL OR error_code IN (
    'invalid_url',
    'fetch_failed',
    'unsupported_source',
    'document_unreadable',
    'document_too_large',
    'no_menu_found',
    'parser_failed',
    'invalid_output'
  ));
