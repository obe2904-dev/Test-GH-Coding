-- Add CTA configuration column to business_profile table
-- This allows businesses to customize their call-to-action preferences

-- Add cta_config JSONB column
ALTER TABLE business_profile 
ADD COLUMN IF NOT EXISTS cta_config JSONB DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN business_profile.cta_config IS 
'CTA configuration for social media posts. Structure:
{
  "default_style": "soft" | "booking",  // Default CTA style preference
  "custom_ctas": {
    "book": "Custom booking CTA text",   // e.g., "Book dit bord nu"
    "visit": "Custom visit CTA text",     // e.g., "Kom forbi i dag"
    "menu": "Custom menu CTA text",       // e.g., "Se vores menu"
    "engage": "Custom engagement CTA"     // e.g., "Del med os"
  },
  "use_emojis": true | false  // Whether to include emojis in CTAs
}';

-- Create index for querying CTA config
CREATE INDEX IF NOT EXISTS idx_business_profile_cta_config 
ON business_profile USING GIN (cta_config);

-- Verify the column was added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'business_profile' 
  AND column_name = 'cta_config';

-- Example usage queries:

-- Get businesses with custom CTAs configured
-- SELECT id, business_name, cta_config 
-- FROM business_profile 
-- WHERE cta_config IS NOT NULL;

-- Get businesses preferring soft CTAs
-- SELECT id, business_name, cta_config->>'default_style' as cta_style
-- FROM business_profile 
-- WHERE cta_config->>'default_style' = 'soft';

-- Set default CTA config for a business (example)
-- UPDATE business_profile 
-- SET cta_config = jsonb_build_object(
--   'default_style', 'soft',
--   'use_emojis', true,
--   'custom_ctas', jsonb_build_object(
--     'book', 'Book dit bord hos os',
--     'visit', 'Kom forbi og smag'
--   )
-- )
-- WHERE id = 'your-business-id';
