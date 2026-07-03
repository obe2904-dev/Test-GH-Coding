-- Add Voice Enrichment Columns
-- Migration for auto-extracted brand voice fields
-- Date: February 4, 2026

-- Add phrase arrays (using text[] for simplicity)
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS signature_phrases text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS never_say text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS typical_openings text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS typical_closings text[] DEFAULT '{}';

-- Add personality trait columns
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS humor_level text,
ADD COLUMN IF NOT EXISTS formality text,
ADD COLUMN IF NOT EXISTS storytelling_style text,
ADD COLUMN IF NOT EXISTS emoji_style text,
ADD COLUMN IF NOT EXISTS punctuation_style text;

-- Add brand story columns
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS brand_origin_story text,
ADD COLUMN IF NOT EXISTS what_makes_us_different text,
ADD COLUMN IF NOT EXISTS signature_approach text,
ADD COLUMN IF NOT EXISTS owner_perspective text,
ADD COLUMN IF NOT EXISTS founded_year integer;

-- Add sample posts (JSONB for structured data)
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS sample_posts jsonb DEFAULT '[]';

-- Add metadata columns
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS voice_extraction_source text,
ADD COLUMN IF NOT EXISTS voice_extracted_at timestamptz,
ADD COLUMN IF NOT EXISTS voice_confidence_score integer;

-- Add comments for documentation
COMMENT ON COLUMN business_brand_profile.signature_phrases IS 
'Auto-extracted signature phrases from offerings, location, and menu (2-8 phrases)';

COMMENT ON COLUMN business_brand_profile.never_say IS 
'Words and phrases to avoid in content generation (8-10 items)';

COMMENT ON COLUMN business_brand_profile.typical_openings IS 
'Common opening phrases for social posts (7-8 items)';

COMMENT ON COLUMN business_brand_profile.typical_closings IS 
'Common closing phrases for social posts (4-5 items)';

COMMENT ON COLUMN business_brand_profile.humor_level IS 
'Inferred humor level: none, subtle, playful';

COMMENT ON COLUMN business_brand_profile.formality IS 
'Inferred formality level: professional, casual, friendly';

COMMENT ON COLUMN business_brand_profile.storytelling_style IS 
'Inferred storytelling approach: facts_only, some_context, rich_stories';

COMMENT ON COLUMN business_brand_profile.emoji_style IS 
'Inferred emoji usage: minimal, moderate, expressive';

COMMENT ON COLUMN business_brand_profile.punctuation_style IS 
'Inferred punctuation style: formal, casual';

COMMENT ON COLUMN business_brand_profile.brand_origin_story IS 
'Brand founding and history narrative';

COMMENT ON COLUMN business_brand_profile.what_makes_us_different IS 
'Key differentiator from competitors';

COMMENT ON COLUMN business_brand_profile.signature_approach IS 
'Unique approach or methodology';

COMMENT ON COLUMN business_brand_profile.owner_perspective IS 
'Owner/founder perspective on the business';

COMMENT ON COLUMN business_brand_profile.founded_year IS 
'Year the business was founded';

COMMENT ON COLUMN business_brand_profile.sample_posts IS 
'Sample social media posts with explanations (array of {post_text, why_this_works})';

COMMENT ON COLUMN business_brand_profile.voice_extraction_source IS 
'Source of voice data: ai_auto_extract, manual, imported';

COMMENT ON COLUMN business_brand_profile.voice_extracted_at IS 
'Timestamp when voice data was last extracted';

COMMENT ON COLUMN business_brand_profile.voice_confidence_score IS 
'Confidence score of voice extraction (0-100)';

-- Add check constraints for enum-like fields (drop if exists first)
DO $$ 
BEGIN
  ALTER TABLE business_brand_profile DROP CONSTRAINT IF EXISTS check_humor_level;
  ALTER TABLE business_brand_profile ADD CONSTRAINT check_humor_level CHECK (humor_level IN ('none', 'subtle', 'playful') OR humor_level IS NULL);
  
  ALTER TABLE business_brand_profile DROP CONSTRAINT IF EXISTS check_formality;
  ALTER TABLE business_brand_profile ADD CONSTRAINT check_formality CHECK (formality IN ('professional', 'casual', 'friendly') OR formality IS NULL);
  
  ALTER TABLE business_brand_profile DROP CONSTRAINT IF EXISTS check_storytelling_style;
  ALTER TABLE business_brand_profile ADD CONSTRAINT check_storytelling_style CHECK (storytelling_style IN ('facts_only', 'some_context', 'rich_stories') OR storytelling_style IS NULL);
  
  ALTER TABLE business_brand_profile DROP CONSTRAINT IF EXISTS check_emoji_style;
  ALTER TABLE business_brand_profile ADD CONSTRAINT check_emoji_style CHECK (emoji_style IN ('minimal', 'moderate', 'expressive') OR emoji_style IS NULL);
  
  ALTER TABLE business_brand_profile DROP CONSTRAINT IF EXISTS check_confidence_score;
  ALTER TABLE business_brand_profile ADD CONSTRAINT check_confidence_score CHECK (voice_confidence_score >= 0 AND voice_confidence_score <= 100 OR voice_confidence_score IS NULL);
END $$;

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_brand_profile_voice_confidence 
ON business_brand_profile (voice_confidence_score) 
WHERE voice_confidence_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_brand_profile_voice_extracted_at 
ON business_brand_profile (voice_extracted_at) 
WHERE voice_extracted_at IS NOT NULL;
