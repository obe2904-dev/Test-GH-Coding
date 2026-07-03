-- Add local_location_reference field for single source of truth on location naming
-- This field stores how locals actually refer to the location (e.g., "ved åen", "i Nyhavn")
-- User-editable, AI-suggested, prevents translation hallucinations

ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS local_location_reference text;

COMMENT ON COLUMN business_location_intelligence.local_location_reference IS 
'How locals refer to this location in natural conversation. Examples: "ved åen" (Aarhus river), "i Nyhavn" (iconic area), "ved Åboulevarden" (street name). User-editable, AI-suggested during enrichment. Single source of truth for all brand profile generation.';

-- Add metadata fields for tracking data quality
ALTER TABLE business_location_intelligence
ADD COLUMN IF NOT EXISTS local_location_reference_source text CHECK (
  local_location_reference_source IN ('ai_suggested', 'user_provided', 'user_confirmed')
),
ADD COLUMN IF NOT EXISTS local_location_reference_updated_at timestamptz;

COMMENT ON COLUMN business_location_intelligence.local_location_reference_source IS 
'Source of the location reference: ai_suggested (AI enrichment), user_provided (manual entry), user_confirmed (AI suggestion confirmed by user)';

-- Update Café Faust with the correct local reference
UPDATE business_location_intelligence
SET 
  local_location_reference = 'ved åen',
  local_location_reference_source = 'user_provided',
  local_location_reference_updated_at = NOW()
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';
