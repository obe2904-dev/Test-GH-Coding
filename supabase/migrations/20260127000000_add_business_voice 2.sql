-- Add business_voice column to business_brand_profile
-- This replaces separate tone + emoji settings with a single voice setting

ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS business_voice TEXT DEFAULT 'friendly'
CHECK (business_voice IN ('formal', 'professional', 'friendly', 'casual'));

-- Add comment explaining the values
COMMENT ON COLUMN business_brand_profile.business_voice IS 
'Business voice/tone setting that controls both language style and emoji usage.
Values:
- formal: Fine dining, luxury (0-1 elegant emoji)
- professional: Upscale casual, bistro (1-2 practical emojis)
- friendly: Cafes, family restaurants (2-3 strategic emojis)
- casual: Bars, young crowd (2-3 expressive emojis)';

-- Update existing NULL values to friendly (safe default)
UPDATE business_brand_profile
SET business_voice = 'friendly'
WHERE business_voice IS NULL;
