-- =====================================================
-- INSERT MINIMAL PROFILE DATA FOR CAFÉ FAUST
-- =====================================================
-- This ensures the Edge Function can find profile data even if it's minimal

-- Insert into business_profile (if not exists)
INSERT INTO business_profile (
  business_id,
  short_description,
  long_description,
  created_at,
  updated_at
)
VALUES (
  '840347de-9ba7-4275-8aa3-4553417fc2af',
  'Café i Aarhus med fokus på kvalitet og hygge',
  'Café Faust er en hyggelig café i hjertet af Aarhus',
  NOW(),
  NOW()
)
ON CONFLICT (business_id) 
DO UPDATE SET
  short_description = COALESCE(business_profile.short_description, EXCLUDED.short_description),
  long_description = COALESCE(business_profile.long_description, EXCLUDED.long_description),
  updated_at = NOW();

-- Update business_brand_profile (ensure it has basic data)
UPDATE business_brand_profile
SET 
  voice_style = COALESCE(voice_style, 'Venlig og imødekommende'),
  tone_keywords = COALESCE(tone_keywords, ARRAY['friendly', 'welcoming', 'warm']::text[]),
  updated_at = NOW()
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Verify the data
SELECT 
  b.id,
  b.name,
  bp.short_description,
  bp.long_description,
  bbp.tone_keywords,
  bbp.voice_style,
  bbp.business_voice,
  bl.city,
  bl.country
FROM businesses b
LEFT JOIN business_profile bp ON bp.business_id = b.id
LEFT JOIN business_brand_profile bbp ON bbp.business_id = b.id
LEFT JOIN business_locations bl ON bl.business_id = b.id
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';
