-- ============================================================================
-- Add Menu Extraction Tracking Columns to menu_results_v2
-- Pipeline Version: 2.0.0
-- Purpose: Track platform, strategy, quality, and artifact metadata
-- ============================================================================

-- Add tracking columns (all nullable for backward compatibility)
ALTER TABLE menu_results_v2 
ADD COLUMN IF NOT EXISTS platform_detected TEXT,
ADD COLUMN IF NOT EXISTS provider_detected TEXT,
ADD COLUMN IF NOT EXISTS strategy_used TEXT,
ADD COLUMN IF NOT EXISTS extraction_run_id UUID,
ADD COLUMN IF NOT EXISTS artifact_storage_prefix TEXT,
ADD COLUMN IF NOT EXISTS quality_summary JSONB,
ADD COLUMN IF NOT EXISTS extraction_attempts INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS pipeline_version TEXT;

-- Add comment explaining new columns
COMMENT ON COLUMN menu_results_v2.platform_detected IS 'Detected CMS/platform (wordpress, umbraco, wix, etc.)';
COMMENT ON COLUMN menu_results_v2.provider_detected IS 'Detected external menu provider (menufy, zenchef, etc.)';
COMMENT ON COLUMN menu_results_v2.strategy_used IS 'Primary extraction strategy that succeeded (structured_json, pdf_text, etc.)';
COMMENT ON COLUMN menu_results_v2.extraction_run_id IS 'UUID linking to detailed extraction run (for operational tracking)';
COMMENT ON COLUMN menu_results_v2.artifact_storage_prefix IS 'Storage path prefix for artifacts (screenshots, HTML, etc.)';
COMMENT ON COLUMN menu_results_v2.quality_summary IS 'Multi-dimensional quality scores {overallScore, completenessScore, evidenceScore, etc.}';
COMMENT ON COLUMN menu_results_v2.extraction_attempts IS 'Number of strategy attempts before success';
COMMENT ON COLUMN menu_results_v2.pipeline_version IS 'Version of extraction pipeline used (e.g., "2.0.0")';

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_menu_results_platform 
  ON menu_results_v2(platform_detected) 
  WHERE platform_detected IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_menu_results_strategy 
  ON menu_results_v2(strategy_used) 
  WHERE strategy_used IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_menu_results_run_id 
  ON menu_results_v2(extraction_run_id) 
  WHERE extraction_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_menu_results_pipeline_version 
  ON menu_results_v2(pipeline_version) 
  WHERE pipeline_version IS NOT NULL;

-- Create GIN index for quality_summary JSONB queries
CREATE INDEX IF NOT EXISTS idx_menu_results_quality_summary_gin 
  ON menu_results_v2 USING gin(quality_summary) 
  WHERE quality_summary IS NOT NULL;

-- ============================================================================
-- Optional: Create Detailed Operational Tracking Tables (Phase 3)
-- Uncomment when ready to track full extraction history
-- ============================================================================

/*
-- Extraction runs (one per complete extraction job)
CREATE TABLE IF NOT EXISTS menu_extraction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES menu_sources(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  status TEXT NOT NULL,
  
  source_type TEXT,
  platform_detected TEXT,
  provider_detected TEXT,
  
  pipeline_version TEXT NOT NULL,
  normalizer_version TEXT,
  validator_version TEXT,
  
  artifact_storage_prefix TEXT,
  artifact_manifest JSONB,
  source_content_hash TEXT,
  
  final_quality_score NUMERIC(4,3),
  
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_status CHECK (status IN (
    'queued', 'discovering', 'fetching', 'rendering', 'extracting',
    'normalizing', 'validating', 'partial', 'done', 
    'manual_review_needed', 'retryable_error', 'permanent_error'
  ))
);

-- Extraction attempts (one per strategy execution within a run)
CREATE TABLE IF NOT EXISTS menu_extraction_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES menu_extraction_runs(id) ON DELETE CASCADE,
  
  strategy_name TEXT NOT NULL,
  strategy_version TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  
  status TEXT NOT NULL,
  
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  error_code TEXT,
  error_message TEXT,
  
  candidate_count INTEGER DEFAULT 0,
  quality_metrics JSONB,
  diagnostics JSONB,
  
  CONSTRAINT unique_run_sequence UNIQUE (run_id, sequence_number),
  CONSTRAINT valid_attempt_status CHECK (status IN (
    'success', 'partial', 'no_menu_found', 'failed'
  ))
);

-- Evidence references (optional, for deep traceability)
CREATE TABLE IF NOT EXISTS menu_extraction_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES menu_extraction_runs(id) ON DELETE CASCADE,
  attempt_id UUID REFERENCES menu_extraction_attempts(id) ON DELETE CASCADE,
  
  evidence_type TEXT NOT NULL,
  artifact_path TEXT,
  source_url TEXT,
  
  -- Location details
  dom_selector TEXT,
  json_path TEXT,
  pdf_page INTEGER,
  bounding_box JSONB,
  
  text_excerpt TEXT,
  content_hash TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_evidence_type CHECK (evidence_type IN (
    'dom_text', 'dom_attribute', 'pdf_text', 'pdf_ocr', 
    'image_ocr', 'json_field', 'api_response', 'screenshot_region'
  ))
);

-- Indexes for operational tables
CREATE INDEX IF NOT EXISTS idx_extraction_runs_source 
  ON menu_extraction_runs(source_id);

CREATE INDEX IF NOT EXISTS idx_extraction_runs_business 
  ON menu_extraction_runs(business_id);

CREATE INDEX IF NOT EXISTS idx_extraction_runs_status 
  ON menu_extraction_runs(status);

CREATE INDEX IF NOT EXISTS idx_extraction_runs_platform 
  ON menu_extraction_runs(platform_detected) 
  WHERE platform_detected IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_extraction_attempts_run 
  ON menu_extraction_attempts(run_id);

CREATE INDEX IF NOT EXISTS idx_extraction_attempts_strategy 
  ON menu_extraction_attempts(strategy_name);

CREATE INDEX IF NOT EXISTS idx_extraction_evidence_run 
  ON menu_extraction_evidence(run_id);

-- Comments for operational tables
COMMENT ON TABLE menu_extraction_runs IS 'Detailed extraction run tracking (one per menu extraction job)';
COMMENT ON TABLE menu_extraction_attempts IS 'Individual strategy attempts within an extraction run';
COMMENT ON TABLE menu_extraction_evidence IS 'Field-level evidence references for extracted data';
*/

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'menu_results_v2' 
  AND column_name IN (
    'platform_detected', 
    'provider_detected', 
    'strategy_used', 
    'extraction_run_id',
    'artifact_storage_prefix',
    'quality_summary',
    'extraction_attempts',
    'pipeline_version'
  )
ORDER BY column_name;

-- Count existing menu results
SELECT COUNT(*) as total_menu_results FROM menu_results_v2;

-- ============================================================================
-- Migration Complete
-- ============================================================================
