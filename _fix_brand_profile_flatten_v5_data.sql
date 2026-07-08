-- Fix: Populate flattened brand profile fields from V5 JSONB
-- When tone_of_voice/voice_constraints are NULL but V5 has data,
-- extract and flatten for better AI prompt construction

UPDATE business_brand_profile
SET 
  -- Create tone_of_voice summary from personality traits + formality
  tone_of_voice = CASE 
    WHEN tone_of_voice IS NULL AND brand_profile_v5->'voice'->>'personality_traits' IS NOT NULL THEN
      jsonb_array_to_text(brand_profile_v5->'voice'->'personality_traits') || 
      CASE 
        WHEN brand_profile_v5->'voice'->>'formality_level' = 'informal' THEN ' · afslappet tone'
        WHEN brand_profile_v5->'voice'->>'formality_level' = 'formal' THEN ' · formel tone'
        WHEN brand_profile_v5->'voice'->>'formality_level' = 'semi-formal' THEN ' · semi-formel tone'
        ELSE ''
      END ||
      CASE 
        WHEN brand_profile_v5->'voice'->>'humor_style' = 'playful' THEN ' · legende'
        WHEN brand_profile_v5->'voice'->>'humor_style' = 'dry' THEN ' · tør humor'
        WHEN brand_profile_v5->'voice'->>'humor_style' = 'serious' THEN ' · seriøs'
        ELSE ''
      END
    ELSE tone_of_voice
  END,
  
  -- Extract voice_constraints from top 2 most important tone rules
  voice_constraints = CASE 
    WHEN voice_constraints IS NULL AND jsonb_array_length(brand_profile_v5->'voice'->'tone_rules') > 0 THEN
      -- Take first tone rule as the main constraint
      brand_profile_v5->'voice'->'tone_rules'->>0
    ELSE voice_constraints
  END

WHERE brand_profile_v5 IS NOT NULL
  AND brand_profile_v5->'voice' IS NOT NULL
  AND (tone_of_voice IS NULL OR voice_constraints IS NULL);

-- Helper function to convert jsonb array to comma-separated text
CREATE OR REPLACE FUNCTION jsonb_array_to_text(arr jsonb)
RETURNS text AS $$
DECLARE
  result text := '';
  item jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(arr)
  LOOP
    IF result != '' THEN
      result := result || ', ';
    END IF;
    result := result || trim(both '"' from item::text);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Now run the update
UPDATE business_brand_profile
SET 
  tone_of_voice = CASE 
    WHEN tone_of_voice IS NULL AND brand_profile_v5->'voice'->'personality_traits' IS NOT NULL THEN
      jsonb_array_to_text(brand_profile_v5->'voice'->'personality_traits') || 
      CASE 
        WHEN brand_profile_v5->'voice'->>'formality_level' = 'informal' THEN ' · afslappet'
        WHEN brand_profile_v5->'voice'->>'formality_level' = 'formal' THEN ' · formel'
        ELSE ' · semi-formel'
      END ||
      CASE 
        WHEN brand_profile_v5->'voice'->>'humor_style' = 'playful' THEN ' · legende'
        WHEN brand_profile_v5->'voice'->>'humor_style' = 'dry' THEN ' · tør humor'
        ELSE ''
      END
    ELSE tone_of_voice
  END,
  
  voice_constraints = CASE 
    WHEN voice_constraints IS NULL AND jsonb_array_length(COALESCE(brand_profile_v5->'voice'->'tone_rules', '[]'::jsonb)) > 0 THEN
      brand_profile_v5->'voice'->'tone_rules'->>0
    ELSE voice_constraints
  END

WHERE brand_profile_v5 IS NOT NULL
  AND brand_profile_v5->'voice' IS NOT NULL
  AND (tone_of_voice IS NULL OR voice_constraints IS NULL);

-- Check results
SELECT 
  business_id,
  tone_of_voice,
  voice_constraints,
  brand_profile_v5->'voice'->'personality_traits' as traits_source
FROM business_brand_profile
WHERE business_id = 'de06238f-6b50-48db-8a02-0fb228eda9f1';
