-- Phase 2 Week 1: Move Forbidden Phrases to Brand Profile
-- This migration adds default forbidden phrases to all existing brand profiles
-- and creates the structure for business-specific tone customization

-- Step 1: Add default marketing clichés to never_say array
UPDATE business_brand_profile
SET brand_profile_v5 = jsonb_set(
  COALESCE(brand_profile_v5, '{}'::jsonb),
  '{guardrails,never_say}',
  '["hygge", "hyggelig", "hyggelige", "hyggefølelse", "hyggepause", "hyggelig stemning",
    "hyggelige rammer", "den perfekte ramme", "indbydende atmosfære", "autentisk oplevelse",
    "lokal perle", "socialt samvær", "fristed", "fristed fra vejret", "oase", "indendørs oase",
    "trækker folk ind", "foråret er på vej", "folk vil forkæle sig selv", "forkælelse", "giv dig selv lov",
    "noget for enhver", "noget for alle", "tag chancen", "friske sæsoningredienser",
    "i læ for vejret", "i ly for vejret", "oplagt valg", "er et oplagt valg", "oplagt udflugtsmål", "oplagt destination"]'::jsonb,
  true
)
WHERE brand_profile_v5 IS NOT NULL
  AND (brand_profile_v5->'guardrails'->'never_say' IS NULL 
       OR jsonb_array_length(brand_profile_v5->'guardrails'->'never_say') = 0);

-- Step 2: Add technical database terms to avoid
UPDATE business_brand_profile
SET brand_profile_v5 = jsonb_set(
  COALESCE(brand_profile_v5, '{}'::jsonb),
  '{guardrails,technical_terms}',
  '["hybrid", "hybridformat", "hybridmodel", "day-to-evening", "day-to-evening format", "treat", "discovery",
    "driftsmodel", "besøgstype", "serviceforløb", "visit_mode", "business_mode"]'::jsonb,
  true
)
WHERE brand_profile_v5 IS NOT NULL
  AND brand_profile_v5->'guardrails'->'technical_terms' IS NULL;

-- Step 3: Add weather cliché rules to guardrails
UPDATE business_brand_profile
SET brand_profile_v5 = jsonb_set(
  COALESCE(brand_profile_v5, '{}'::jsonb),
  '{guardrails,weather_cliches}',
  '["skubber gæsterne indendørs", "skubber indendørs", "trækker gæsterne indendørs", "trækker indendørs",
    "vejret gør stedet attraktivt", "vejret indbyder", "søger indendørs alternativer",
    "det kolde vejr indbyder til", "i læ for vejret", "i ly for vejret"]'::jsonb,
  true
)
WHERE brand_profile_v5 IS NOT NULL
  AND brand_profile_v5->'guardrails'->'weather_cliches' IS NULL;

-- Step 4: Add location framing rules to guardrails
UPDATE business_brand_profile
SET brand_profile_v5 = jsonb_set(
  COALESCE(brand_profile_v5, '{}'::jsonb),
  '{guardrails,location_suffix_phrases}',
  '["med udsigt til", "som ramme", "ved [lokation]", "i baggrunden", 
    "vinduesborde med", "frokostpause ved"]'::jsonb,
  true
)
WHERE brand_profile_v5 IS NOT NULL
  AND brand_profile_v5->'guardrails'->'location_suffix_phrases' IS NULL;

-- Verification queries
-- Check how many profiles were updated
SELECT 
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN brand_profile_v5->'guardrails'->'never_say' IS NOT NULL THEN 1 END) as has_never_say,
  COUNT(CASE WHEN brand_profile_v5->'guardrails'->'technical_terms' IS NOT NULL THEN 1 END) as has_technical_terms,
  COUNT(CASE WHEN brand_profile_v5->'guardrails'->'weather_cliches' IS NOT NULL THEN 1 END) as has_weather_cliches,
  COUNT(CASE WHEN brand_profile_v5->'guardrails'->'location_suffix_phrases' IS NOT NULL THEN 1 END) as has_location_rules
FROM business_brand_profile
WHERE brand_profile_v5 IS NOT NULL;

-- Sample one profile to verify structure
SELECT 
  business_id,
  jsonb_array_length(brand_profile_v5->'guardrails'->'never_say') as never_say_count,
  jsonb_array_length(brand_profile_v5->'guardrails'->'technical_terms') as technical_terms_count,
  brand_profile_v5->'guardrails'->'never_say' as never_say_sample
FROM business_brand_profile
WHERE brand_profile_v5 IS NOT NULL
LIMIT 1;
