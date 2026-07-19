-- Add source_id column to menu_results_v2 for tracking which menu_sources row triggered this extraction
ALTER TABLE menu_results_v2 
ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES menu_sources(id) ON DELETE CASCADE;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_menu_results_v2_source_id 
  ON menu_results_v2(source_id) 
  WHERE source_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN menu_results_v2.source_id IS 'Reference to menu_sources row that triggered this extraction job';
