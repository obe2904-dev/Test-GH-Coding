-- ============================================================================
-- VERIFY BUSINESS CONTEXT DATA
-- SQL queries to check the data sources for AI prompts
-- ============================================================================

-- Query 1: Check BUSINESSES table (name, category, country)
-- This provides: Name, Type, Country
-- ============================================================================
SELECT 
  b.id,
  b.name as "Business Name",
  b.category as "Business Type/Category",
  b.country as "Country",
  bl.city as "City",
  bl.address_line1 as "Address",
  b.created_at as "Created At"
FROM businesses b
LEFT JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
WHERE b.owner_id = auth.uid()
ORDER BY b.created_at DESC;

-- Expected columns used in prompt:
-- - name → "Café Faust"
-- - category → "cafe" 
-- - country → "Denmark"
-- - city → "Copenhagen" (from business_locations table)


-- Query 2: Check BUSINESS_BRAND_PROFILE table (values, certifications)
-- This provides: Values, Certifications, Tone, Voice Style
-- ============================================================================
SELECT 
  business_id,
  values as "Brand Values",
  certifications as "Certifications",
  tone_keywords as "Tone Keywords",
  voice_style as "Voice Style",
  do_not_say as "Banned Words",
  created_at as "Profile Created"
FROM business_brand_profile
WHERE business_id IN (
  SELECT id FROM businesses WHERE owner_id = auth.uid()
)
ORDER BY created_at DESC;

-- Expected columns used in prompt:
-- - values → ["økologisk", "bæredygtig", "lokal"]
-- - certifications → ["Ø-mærket"]
-- - tone_keywords → ["hyggelig", "uformel", "lokal"]
-- - voice_style → "du-form, emojis ok"


-- Query 3: COMBINED VIEW - Everything used in Business Context
-- Shows exactly what goes into the AI prompt
-- ============================================================================
SELECT 
  b.name as "Business Name",
  b.category as "Type",
  bl.city as "City",
  b.country as "Country",
  bp.values as "Values",
  bp.certifications as "Certifications",
  bp.tone_keywords as "Tone Keywords",
  bp.voice_style as "Voice Style",
  bp.do_not_say as "Banned Words"
FROM businesses b
LEFT JOIN business_brand_profile bp ON b.id = bp.business_id
LEFT JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
WHERE b.owner_id = auth.uid()
ORDER BY b.created_at DESC;

-- This shows the exact data that becomes:
-- BUSINESS CONTEXT:
-- - Name: {Business Name}
-- - Type: {Type}
-- - Location: {City}, {Country}
-- - Values: {Values joined with ', '}
-- - Certifications: {Certifications joined with ', '}


-- Query 4: Check for MISSING data (troubleshooting)
-- Identifies what might be missing from your brand profile
-- ============================================================================
SELECT 
  b.name as "Business Name",
  CASE WHEN b.name IS NULL THEN '❌' ELSE '✅' END as "Has Name",
  CASE WHEN b.category IS NULL THEN '❌' ELSE '✅' END as "Has Category",
  CASE WHEN b.country IS NULL THEN '❌' ELSE '✅' END as "Has Country",
  CASE WHEN bl.city IS NULL THEN '❌' ELSE '✅' END as "Has City",
  CASE WHEN bp.values IS NULL OR array_length(bp.values, 1) IS NULL OR array_length(bp.values, 1) = 0 THEN '❌' ELSE '✅' END as "Has Values",
  CASE WHEN bp.certifications IS NULL OR array_length(bp.certifications, 1) IS NULL OR array_length(bp.certifications, 1) = 0 THEN '❌' ELSE '✅' END as "Has Certifications",
  CASE WHEN bp.tone_keywords IS NULL OR array_length(bp.tone_keywords, 1) IS NULL OR array_length(bp.tone_keywords, 1) = 0 THEN '❌' ELSE '✅' END as "Has Tone Keywords",
  CASE WHEN bp.voice_style IS NULL THEN '❌' ELSE '✅' END as "Has Voice Style"
FROM businesses b
LEFT JOIN business_brand_profile bp ON b.id = bp.business_id
LEFT JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
WHERE b.owner_id = auth.uid();

-- Shows checkmarks for what data exists


-- Query 5: DETAILED INSPECTION - Your test café specifically
-- Replace 'YOUR_BUSINESS_ID' with your actual test café's ID
-- ============================================================================
WITH test_business AS (
  SELECT id FROM businesses 
  WHERE owner_id = auth.uid() 
  AND name ILIKE '%faust%'  -- Adjust if your test café has a different name
  LIMIT 1
)
SELECT 
  'Business Info' as "Section",
  jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'category', b.category,
    'country', b.country,
    'city', bl.city,
    'address', bl.address_line1
  ) as "Data"
FROM businesses b
LEFT JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
CROSS JOIN test_business
WHERE b.id = test_business.id

UNION ALL

SELECT 
  'Brand Profile' as "Section",
  jsonb_build_object(
    'values', bp.values,
    'certifications', bp.certifications,
    'tone_keywords', bp.tone_keywords,
    'voice_style', bp.voice_style,
    'do_not_say', bp.do_not_say
  ) as "Data"
FROM business_brand_profile bp
CROSS JOIN test_business
WHERE bp.business_id = test_business.id;

-- Returns JSON objects showing all data


-- Query 6: SIMULATED PROMPT OUTPUT
-- Shows exactly what the AI prompt will contain
-- ============================================================================
SELECT 
  'BUSINESS CONTEXT:' || E'\n' ||
  '- Name: ' || b.name || E'\n' ||
  '- Type: ' || b.category || E'\n' ||
  '- Location: ' || COALESCE(bl.city || ', ', '') || b.country || E'\n' ||
  CASE 
    WHEN bp.values IS NOT NULL AND array_length(bp.values, 1) > 0 
    THEN '- Values: ' || array_to_string(bp.values, ', ') || E'\n'
    ELSE ''
  END ||
  CASE 
    WHEN bp.certifications IS NOT NULL AND array_length(bp.certifications, 1) > 0 
    THEN '- Certifications: ' || array_to_string(bp.certifications, ', ') || E'\n'
    ELSE ''
  END as "Exact Prompt Text"
FROM businesses b
LEFT JOIN business_brand_profile bp ON b.id = bp.business_id
LEFT JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
WHERE b.owner_id = auth.uid()
ORDER BY b.created_at DESC
LIMIT 1;

-- This is EXACTLY what goes into the AI prompt


-- ============================================================================
-- USAGE INSTRUCTIONS:
-- ============================================================================
-- 1. Run Query 1 to see your business basic info
-- 2. Run Query 2 to see your brand profile data
-- 3. Run Query 3 to see everything combined
-- 4. Run Query 4 to check for missing data (❌ means missing)
-- 5. Run Query 5 to inspect your test café specifically
-- 6. Run Query 6 to see the EXACT prompt text that will be generated

-- Expected Results for "Café Faust":
-- Name: Café Faust
-- Type: cafe
-- Location: Copenhagen, Denmark
-- Values: økologisk, bæredygtig, lokal
-- Certifications: Ø-mærket
