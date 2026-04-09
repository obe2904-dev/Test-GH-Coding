-- Add structured tone model column to business_brand_profile
-- This provides machine-usable tone guidance while maintaining backwards compatibility

-- Add tone_model JSONB column
ALTER TABLE business_brand_profile 
ADD COLUMN IF NOT EXISTS tone_model JSONB;

-- Add comment explaining the structure
COMMENT ON COLUMN business_brand_profile.tone_model IS 
'Structured tone model for AI generation. Schema: {
  primary_keywords: string[] (2-3 core adjectives for validation),
  writing_rules: string[] (3-5 style rules from tone_of_voice),
  good_examples: string[] (2-3 positive example phrases),
  avoid_examples: string[] (2-3 negative examples with reasons),
  formality: "formal" | "informal" | "mixed",
  emoji_level: "none" | "minimal" | "moderate" | "expressive"
}';

-- Index for primary_keywords lookups (GIN index for JSONB array)
CREATE INDEX IF NOT EXISTS idx_tone_model_keywords 
ON business_brand_profile USING GIN ((tone_model -> 'primary_keywords'));

-- Validation constraint (optional - ensures structure when populated)
ALTER TABLE business_brand_profile 
ADD CONSTRAINT tone_model_valid_structure 
CHECK (
  tone_model IS NULL OR (
    jsonb_typeof(tone_model) = 'object' AND
    (tone_model ? 'primary_keywords') AND
    jsonb_typeof(tone_model -> 'primary_keywords') = 'array'
  )
);
