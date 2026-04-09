-- Example Queries for Location Enrichment & Execution Profile
-- These queries demonstrate how to work with the new JSONB columns

-- =====================================
-- LOCATION ENRICHMENT EXAMPLES
-- =====================================

-- 1. Insert location enrichment for a business location
UPDATE public.business_locations
SET enrichment = jsonb_build_object(
  'version', '1.0',
  'geo', jsonb_build_object(
    'lat', 56.1629,
    'lng', 10.2039,
    'accuracy', 'high'
  ),
  'macro', jsonb_build_object(
    'country', 'Denmark',
    'region', 'Midtjylland',
    'city', 'Aarhus',
    'city_tier', 'major_city'
  ),
  'micro', jsonb_build_object(
    'area_type', 'waterfront',
    'nearby_signals', ARRAY['ved åen', 'nær Latinerkvarteret', 'havnefront'],
    'confidence', 'high'
  )
)
WHERE id = '<location-id>';

-- 2. Query locations by city tier
SELECT 
  bl.id,
  bl.city,
  bl.enrichment->>'macro'->>'city_tier' as city_tier,
  bl.enrichment->>'micro'->>'area_type' as area_type
FROM public.business_locations bl
WHERE bl.enrichment->'macro'->>'city_tier' = 'capital';

-- 3. Find waterfront locations
SELECT 
  bl.id,
  bl.city,
  bl.enrichment->'macro'->>'city' as city,
  bl.enrichment->'micro'->>'area_type' as area_type,
  bl.enrichment->'micro'->>'nearby_signals' as nearby_signals
FROM public.business_locations bl
WHERE bl.enrichment->'micro'->>'area_type' = 'waterfront';

-- 4. Query by country and city tier
SELECT 
  bl.id,
  bl.enrichment->'macro'->>'country' as country,
  bl.enrichment->'macro'->>'city' as city,
  bl.enrichment->'macro'->>'city_tier' as city_tier
FROM public.business_locations bl
WHERE bl.enrichment->'macro'->>'country' = 'Denmark'
  AND bl.enrichment->'macro'->>'city_tier' IN ('capital', 'major_city');

-- 5. Check enrichment confidence
SELECT 
  bl.id,
  bl.city,
  bl.enrichment->'micro'->>'confidence' as micro_confidence,
  bl.enrichment->'micro'->>'area_type' as area_type
FROM public.business_locations bl
WHERE bl.enrichment->'micro'->>'confidence' = 'high';

-- =====================================
-- EXECUTION PROFILE EXAMPLES
-- =====================================

-- 6. Insert execution profile for a brand
UPDATE public.business_brand_profile
SET execution_profile = jsonb_build_object(
  'version', '1.0',
  'locale_context', jsonb_build_object(
    'primary_language', 'Danish',
    'country', 'Denmark',
    'city', 'Aarhus',
    'city_tier', 'major_city',
    'region', 'Midtjylland'
  ),
  'micro_location_context', jsonb_build_object(
    'area_type', 'waterfront',
    'nearby_signals', ARRAY['ved åen', 'nær Latinerkvarteret'],
    'confidence', 'high'
  ),
  'usage_occasions', ARRAY[
    'Når gæster samles om længere brunch ved åen',
    'Når børn kan spise med uden bøvl',
    'Når aftenen glider fra middag til cocktails'
  ],
  'offerings_allowlist', jsonb_build_object(
    'menu_items', jsonb_build_array(
      jsonb_build_object('name', 'Brunch', 'category', 'Breakfast'),
      jsonb_build_object('name', 'Frokost', 'category', 'Lunch'),
      jsonb_build_object('name', 'Cocktails', 'category', 'Drinks')
    ),
    'allowed_generics', ARRAY['brunch', 'frokost', 'middag', 'cocktails', 'kaffe']
  ),
  'cta_policy', jsonb_build_object(
    'primary_intent', 'book',
    'facebook', jsonb_build_object('allow_url', true),
    'instagram', jsonb_build_object(
      'allow_url', false,
      'fallback_text', 'Book via link i bio'
    )
  ),
  'forbidden_terms', ARRAY['lækker', 'hyggelig', 'afslappet', 'autentisk', 'unik'],
  'photo_rules', jsonb_build_object(
    'dos', ARRAY[
      'Billeder ved åen med morgen/aftenlys',
      'Fokus på brunch-opsætninger og gæster',
      'Opstillinger på terrassen med havneudsigt'
    ],
    'donts', ARRAY[
      'Generiske madbilleder uden personlighed',
      'Mørke billeder uden naturligt lys',
      'Stockfoto-æstetik'
    ],
    'signature_pattern', 'Gæster ved bordet på havnefronten i gyldent lys'
  )
)
WHERE business_id = '<business-id>';

-- 7. Query execution profiles by primary language
SELECT 
  bbp.business_id,
  bbp.execution_profile->'locale_context'->>'primary_language' as language,
  bbp.execution_profile->'locale_context'->>'city' as city
FROM public.business_brand_profile bbp
WHERE bbp.execution_profile->'locale_context'->>'primary_language' = 'Danish';

-- 8. Find profiles with Instagram CTA policy
SELECT 
  bbp.business_id,
  bbp.execution_profile->'cta_policy'->'instagram'->>'allow_url' as instagram_allow_url,
  bbp.execution_profile->'cta_policy'->'instagram'->>'fallback_text' as fallback_text
FROM public.business_brand_profile bbp
WHERE bbp.execution_profile->'cta_policy'->'instagram'->>'allow_url' = 'false';

-- 9. Query profiles by area type (via micro_location_context)
SELECT 
  bbp.business_id,
  bbp.execution_profile->'micro_location_context'->>'area_type' as area_type,
  bbp.execution_profile->'micro_location_context'->>'nearby_signals' as nearby_signals
FROM public.business_brand_profile bbp
WHERE bbp.execution_profile->'micro_location_context'->>'area_type' = 'waterfront';

-- 10. Get usage occasions for a profile
SELECT 
  bbp.business_id,
  jsonb_array_elements_text(bbp.execution_profile->'usage_occasions') as usage_occasion
FROM public.business_brand_profile bbp
WHERE bbp.execution_profile IS NOT NULL;

-- 11. Query profiles by forbidden terms
SELECT 
  bbp.business_id,
  bbp.execution_profile->'forbidden_terms' as forbidden_terms
FROM public.business_brand_profile bbp
WHERE bbp.execution_profile->'forbidden_terms' @> '["lækker"]'::jsonb;

-- 12. Get photo dos/donts
SELECT 
  bbp.business_id,
  bbp.execution_profile->'photo_rules'->'dos' as photo_dos,
  bbp.execution_profile->'photo_rules'->'donts' as photo_donts,
  bbp.execution_profile->'photo_rules'->>'signature_pattern' as signature_shot
FROM public.business_brand_profile bbp
WHERE bbp.execution_profile->'photo_rules' IS NOT NULL;

-- =====================================
-- COMBINED QUERIES (JOIN BOTH)
-- =====================================

-- 13. Get business location + brand execution profile
SELECT 
  b.name as business_name,
  bl.city,
  bl.enrichment->'macro'->>'city_tier' as city_tier,
  bl.enrichment->'micro'->>'area_type' as area_type,
  bbp.execution_profile->'locale_context'->>'primary_language' as language,
  bbp.execution_profile->'usage_occasions' as usage_occasions,
  bbp.execution_profile->'cta_policy'->'primary_intent' as primary_cta
FROM public.businesses b
LEFT JOIN public.business_locations bl ON bl.business_id = b.id AND bl.is_primary = true
LEFT JOIN public.business_brand_profile bbp ON bbp.business_id = b.id
WHERE bl.enrichment IS NOT NULL
  AND bbp.execution_profile IS NOT NULL;

-- 14. Match location enrichment area_type with execution profile area_type
-- (Verify consistency between location and profile)
SELECT 
  b.name,
  bl.enrichment->'micro'->>'area_type' as location_area_type,
  bbp.execution_profile->'micro_location_context'->>'area_type' as profile_area_type,
  CASE 
    WHEN bl.enrichment->'micro'->>'area_type' = bbp.execution_profile->'micro_location_context'->>'area_type' 
    THEN 'Consistent ✓'
    ELSE 'Mismatch ✗'
  END as consistency_check
FROM public.businesses b
JOIN public.business_locations bl ON bl.business_id = b.id AND bl.is_primary = true
JOIN public.business_brand_profile bbp ON bbp.business_id = b.id
WHERE bl.enrichment IS NOT NULL
  AND bbp.execution_profile IS NOT NULL;

-- =====================================
-- MIGRATION/POPULATION QUERIES
-- =====================================

-- 15. Check which businesses need location enrichment
SELECT 
  b.id,
  b.name,
  bl.city,
  CASE 
    WHEN bl.enrichment IS NULL THEN 'Needs enrichment'
    ELSE 'Has enrichment'
  END as enrichment_status
FROM public.businesses b
LEFT JOIN public.business_locations bl ON bl.business_id = b.id AND bl.is_primary = true;

-- 16. Check which brands need execution profile
SELECT 
  b.id,
  b.name,
  CASE 
    WHEN bbp.execution_profile IS NULL THEN 'Needs execution profile'
    ELSE 'Has execution profile'
  END as profile_status
FROM public.businesses b
LEFT JOIN public.business_brand_profile bbp ON bbp.business_id = b.id;

-- 17. Count enriched locations by city tier
SELECT 
  bl.enrichment->'macro'->>'city_tier' as city_tier,
  COUNT(*) as location_count
FROM public.business_locations bl
WHERE bl.enrichment IS NOT NULL
GROUP BY bl.enrichment->'macro'->>'city_tier'
ORDER BY location_count DESC;

-- 18. Count execution profiles by area type
SELECT 
  bbp.execution_profile->'micro_location_context'->>'area_type' as area_type,
  COUNT(*) as profile_count
FROM public.business_brand_profile bbp
WHERE bbp.execution_profile IS NOT NULL
GROUP BY bbp.execution_profile->'micro_location_context'->>'area_type'
ORDER BY profile_count DESC;
