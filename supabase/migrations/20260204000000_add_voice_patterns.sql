-- Voice Patterns Enhancement Migration
-- Adds authentic voice execution fields to capture real writing samples
-- Date: February 4, 2026

-- ============================================================================
-- Add Voice Execution Fields (from writing samples analysis)
-- ============================================================================

ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS voice_execution jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS personality jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS brand_context jsonb DEFAULT NULL;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN business_brand_profile.voice_execution IS 
'Authentic voice patterns extracted from owner writing samples: signature phrases (with sources), typical openings, writing patterns (sentence length, emoji frequency, punctuation style)';

COMMENT ON COLUMN business_brand_profile.personality IS 
'Personality calibration from actual content: humor_level (none/subtle/playful/bold), formality (formal/professional/casual/friendly), storytelling_style (facts_only/contextual/rich_stories)';

COMMENT ON COLUMN business_brand_profile.brand_context IS 
'Brand heritage and local context: origin_story, unique_differentiator, local_landmarks (specific place names from owner content)';

-- ============================================================================
-- Example Data Structure (for reference)
-- ============================================================================

/*
voice_execution structure:
{
  "signature_phrases": [
    {
      "phrase": "Den her gryde har reddet os siden 98",
      "source": "business_description",
      "usage_context": "Heritage and tradition posts"
    }
  ],
  "typical_openings": [
    "God morgen fra Åen! ☕",
    "Weekend-stemning starter nu 🍷"
  ],
  "writing_patterns": {
    "sentence_length": "short",
    "emoji_frequency": "moderate",
    "punctuation_style": "Uses ... often, minimal exclamation"
  }
}

personality structure:
{
  "humor_level": "playful",
  "formality": "casual",
  "storytelling_style": "rich_stories"
}

brand_context structure:
{
  "origin_story": "Familiedrevet siden 1998, oprindeligt en lokal kaffebar",
  "unique_differentiator": "Eneste restaurant ved Åen med egne retter fra 90'erne",
  "local_landmarks": ["Åen", "Aarhus Domkirke", "Latinerkvarteret"]
}
*/

-- ============================================================================
-- Validation Functions (optional, for data integrity)
-- ============================================================================

-- Create a function to validate voice_execution structure
CREATE OR REPLACE FUNCTION validate_voice_execution(data jsonb)
RETURNS boolean AS $$
BEGIN
  -- Allow NULL
  IF data IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check required keys exist
  IF NOT (data ? 'signature_phrases' AND data ? 'typical_openings' AND data ? 'writing_patterns') THEN
    RETURN false;
  END IF;
  
  -- Validate signature_phrases is an array
  IF jsonb_typeof(data->'signature_phrases') != 'array' THEN
    RETURN false;
  END IF;
  
  -- Validate typical_openings is an array
  IF jsonb_typeof(data->'typical_openings') != 'array' THEN
    RETURN false;
  END IF;
  
  -- Validate writing_patterns is an object
  IF jsonb_typeof(data->'writing_patterns') != 'object' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Create a function to validate personality structure
CREATE OR REPLACE FUNCTION validate_personality(data jsonb)
RETURNS boolean AS $$
BEGIN
  -- Allow NULL
  IF data IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check required keys exist
  IF NOT (data ? 'humor_level' AND data ? 'formality' AND data ? 'storytelling_style') THEN
    RETURN false;
  END IF;
  
  -- Validate enum values
  IF NOT (data->>'humor_level' IN ('none', 'subtle', 'playful', 'bold')) THEN
    RETURN false;
  END IF;
  
  IF NOT (data->>'formality' IN ('formal', 'professional', 'casual', 'friendly')) THEN
    RETURN false;
  END IF;
  
  IF NOT (data->>'storytelling_style' IN ('facts_only', 'contextual', 'rich_stories')) THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Create a function to validate brand_context structure
CREATE OR REPLACE FUNCTION validate_brand_context(data jsonb)
RETURNS boolean AS $$
BEGIN
  -- Allow NULL
  IF data IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check required keys exist
  IF NOT (data ? 'unique_differentiator' AND data ? 'local_landmarks') THEN
    RETURN false;
  END IF;
  
  -- Validate local_landmarks is an array
  IF jsonb_typeof(data->'local_landmarks') != 'array' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Add Check Constraints
-- ============================================================================

ALTER TABLE business_brand_profile
ADD CONSTRAINT check_voice_execution_structure 
CHECK (validate_voice_execution(voice_execution));

ALTER TABLE business_brand_profile
ADD CONSTRAINT check_personality_structure 
CHECK (validate_personality(personality));

ALTER TABLE business_brand_profile
ADD CONSTRAINT check_brand_context_structure 
CHECK (validate_brand_context(brand_context));

-- ============================================================================
-- Create Index for JSON Queries (optional, for performance)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_brand_profile_voice_patterns 
ON business_brand_profile USING gin (voice_execution);

CREATE INDEX IF NOT EXISTS idx_brand_profile_personality 
ON business_brand_profile USING gin (personality);

CREATE INDEX IF NOT EXISTS idx_brand_profile_brand_context 
ON business_brand_profile USING gin (brand_context);

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Ensure authenticated users can update these fields
-- (Adjust based on your RLS policies)

COMMENT ON TABLE business_brand_profile IS 'Business brand profile including voice patterns, personality, and authentic writing samples';
