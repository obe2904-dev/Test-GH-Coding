-- Enhanced structured tone model with metadata and stronger validation
-- Version 2: Adds versioning, language support, confidence scoring, and stricter constraints

-- Drop old constraint if exists
ALTER TABLE business_brand_profile 
DROP CONSTRAINT IF EXISTS tone_model_valid_structure;

-- Drop old index (will recreate with better structure)
DROP INDEX IF EXISTS idx_tone_model_keywords;

-- Add tone_model JSONB column (idempotent)
ALTER TABLE business_brand_profile 
ADD COLUMN IF NOT EXISTS tone_model JSONB;

-- Add comprehensive comment explaining the enhanced structure
COMMENT ON COLUMN business_brand_profile.tone_model IS 
'Structured tone model v2 for AI generation with metadata. Schema: {
  -- Core tone data
  primary_keywords: string[] (2-6 core adjectives),
  writing_rules: string[] (3-8 actionable style rules),
  good_examples: string[] (2-6 positive example phrases),
  avoid_examples: string[] (2-6 negative examples with reasons),
  formality: "formal" | "informal" | "mixed",
  emoji_level: "none" | "minimal" | "moderate" | "frequent",
  
  -- Metadata (v2)
  version: string (schema version, e.g., "2.0"),
  language: string (ISO 639-1 code, e.g., "da", "en"),
  generated_at: string (ISO 8601 timestamp),
  source: "website" | "manual" | "hybrid",
  confidence: "high" | "medium" | "low",
  notes: string (optional debug info)
}';

-- Create GIN index for primary_keywords and language (multi-language support)
CREATE INDEX IF NOT EXISTS idx_tone_model_keywords_lang 
ON business_brand_profile USING GIN (
  (tone_model -> 'primary_keywords'), 
  (tone_model -> 'language')
);

-- Create index for confidence filtering (find low-confidence for review)
CREATE INDEX IF NOT EXISTS idx_tone_model_confidence 
ON business_brand_profile ((tone_model ->> 'confidence'))
WHERE tone_model IS NOT NULL;

-- Add comprehensive validation constraint
ALTER TABLE business_brand_profile 
ADD CONSTRAINT tone_model_valid_structure_v2
CHECK (
  tone_model IS NULL OR (
    -- Must be object
    jsonb_typeof(tone_model) = 'object' AND
    
    -- Required core fields exist
    (tone_model ? 'primary_keywords') AND
    (tone_model ? 'writing_rules') AND
    (tone_model ? 'good_examples') AND
    (tone_model ? 'avoid_examples') AND
    (tone_model ? 'formality') AND
    (tone_model ? 'emoji_level') AND
    
    -- Required metadata fields exist
    (tone_model ? 'version') AND
    (tone_model ? 'language') AND
    (tone_model ? 'generated_at') AND
    (tone_model ? 'source') AND
    (tone_model ? 'confidence') AND
    
    -- Array type validation
    jsonb_typeof(tone_model -> 'primary_keywords') = 'array' AND
    jsonb_typeof(tone_model -> 'writing_rules') = 'array' AND
    jsonb_typeof(tone_model -> 'good_examples') = 'array' AND
    jsonb_typeof(tone_model -> 'avoid_examples') = 'array' AND
    
    -- Array bounds (2-6, 3-8, 2-6, 2-6)
    jsonb_array_length(tone_model -> 'primary_keywords') BETWEEN 2 AND 6 AND
    jsonb_array_length(tone_model -> 'writing_rules') BETWEEN 3 AND 8 AND
    jsonb_array_length(tone_model -> 'good_examples') BETWEEN 2 AND 6 AND
    jsonb_array_length(tone_model -> 'avoid_examples') BETWEEN 2 AND 6 AND
    
    -- Enum validation for formality
    (tone_model ->> 'formality') IN ('formal', 'informal', 'mixed') AND
    
    -- Enum validation for emoji_level
    (tone_model ->> 'emoji_level') IN ('none', 'minimal', 'moderate', 'frequent') AND
    
    -- Enum validation for source
    (tone_model ->> 'source') IN ('website', 'manual', 'hybrid') AND
    
    -- Enum validation for confidence
    (tone_model ->> 'confidence') IN ('high', 'medium', 'low') AND
    
    -- String length validation (prevent bloat)
    length(tone_model ->> 'version') <= 10 AND
    length(tone_model ->> 'language') BETWEEN 2 AND 5 AND
    length(tone_model ->> 'generated_at') <= 30 AND
    length(tone_model ->> 'notes') <= 500
  )
);
