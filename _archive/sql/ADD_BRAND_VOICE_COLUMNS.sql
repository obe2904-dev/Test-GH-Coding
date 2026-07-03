-- Add 9 canonical Brand Voice variables to business_brand_profile table
-- These variables provide explicit brand guidance for AI content generation

-- Add brand essence column (highest priority - core brand identity)
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS brand_essence TEXT;

-- Add tone of voice column (highest priority - communication style)
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS tone_of_voice TEXT;

-- Add things to avoid column (highest priority - guardrails)
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS things_to_avoid TEXT;

-- Add target audience column (high priority - who we're speaking to)
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS target_audience TEXT;

-- Add core offerings column (high priority - what we offer)
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS core_offerings TEXT;

-- Add content focus column (high priority - what we talk about)
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS content_focus TEXT;

-- Add CTA style column (high priority - how we drive action)
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS cta_style TEXT;

-- Add communication goal column (high priority - what we aim to achieve)
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS communication_goal TEXT;

-- Add image preferences column (medium priority - visual style guidance)
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS image_preferences TEXT;

-- Add comment to document the brand voice system
COMMENT ON COLUMN business_brand_profile.brand_essence IS 'Core brand identity - what makes the brand unique (5-star priority)';
COMMENT ON COLUMN business_brand_profile.tone_of_voice IS 'Communication style - how AI should speak for the brand (5-star priority)';
COMMENT ON COLUMN business_brand_profile.things_to_avoid IS 'Guardrails - words, phrases, or topics AI should never use (5-star priority)';
COMMENT ON COLUMN business_brand_profile.target_audience IS 'Primary audience - who the brand speaks to (4-star priority)';
COMMENT ON COLUMN business_brand_profile.core_offerings IS 'Primary products/services AI can reference (4-star priority)';
COMMENT ON COLUMN business_brand_profile.content_focus IS 'Content themes and topics to emphasize (4-star priority)';
COMMENT ON COLUMN business_brand_profile.cta_style IS 'Call-to-action style preference (4-star priority)';
COMMENT ON COLUMN business_brand_profile.communication_goal IS 'Overall communication objective (4-star priority)';
COMMENT ON COLUMN business_brand_profile.image_preferences IS 'Visual style and image preferences (3-star priority)';

-- Verify columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'business_brand_profile'
  AND column_name IN (
    'brand_essence',
    'tone_of_voice',
    'things_to_avoid',
    'target_audience',
    'core_offerings',
    'content_focus',
    'cta_style',
    'communication_goal',
    'image_preferences'
  )
ORDER BY column_name;
