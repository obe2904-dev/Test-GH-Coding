-- ============================================================================
-- TEST WITH REAL CAFÉ FAUST DATA
-- Quick verification of what data exists vs what's empty
-- ============================================================================

-- STEP 1: Find your Café Faust business ID
-- ============================================================================
SELECT 
  id as "Business ID",
  name as "Business Name",
  category,
  country,
  created_at
FROM businesses
WHERE owner_id = auth.uid()
ORDER BY created_at DESC;

-- Copy the ID from above and use it below (or it will auto-detect if name contains 'faust')


-- STEP 2: COMPLETE DATA CHECK - What's populated vs empty
-- ============================================================================
WITH cafe AS (
  SELECT id FROM businesses 
  WHERE owner_id = auth.uid() 
  AND (name ILIKE '%faust%' OR name ILIKE '%test%')
  LIMIT 1
)
SELECT 
  '📊 BUSINESSES TABLE' as "Data Source",
  jsonb_build_object(
    '✅ name', b.name,
    '✅ category', b.category,
    '✅ country', b.country,
    '✅ vertical', b.vertical,
    'website_url', b.website_url,
    'primary_language', b.primary_language
  ) as "Data",
  CASE 
    WHEN b.name IS NOT NULL THEN 'HAS DATA ✅'
    ELSE 'EMPTY ❌'
  END as "Status"
FROM businesses b
CROSS JOIN cafe
WHERE b.id = cafe.id

UNION ALL

SELECT 
  '🎨 BRAND PROFILE (business_brand_profile)' as "Data Source",
  jsonb_build_object(
    'tone_keywords (ARRAY)', bp.tone_keywords,
    'values (ARRAY)', bp.values,
    'certifications (ARRAY)', bp.certifications,
    'voice_style (TEXT)', bp.voice_style,
    'do_not_say (JSONB)', bp.do_not_say,
    'business_voice (TEXT)', bp.business_voice,
    'cta_preference (TEXT)', bp.cta_preference,
    'booking_link (TEXT)', bp.booking_link
  ) as "Data",
  CASE 
    WHEN bp.business_id IS NOT NULL THEN 'HAS DATA ✅'
    ELSE 'EMPTY ❌'
  END as "Status"
FROM business_brand_profile bp
CROSS JOIN cafe
WHERE bp.business_id = cafe.id

UNION ALL

SELECT 
  '📍 LOCATIONS (business_locations)' as "Data Source",
  jsonb_build_object(
    'city', bl.city,
    'address_line1', bl.address_line1,
    'postal_code', bl.postal_code,
    'is_primary', bl.is_primary
  ) as "Data",
  CASE 
    WHEN bl.id IS NOT NULL THEN 'HAS DATA ✅'
    ELSE 'EMPTY ❌'
  END as "Status"
FROM business_locations bl
CROSS JOIN cafe
WHERE bl.business_id = cafe.id AND bl.is_primary = true

UNION ALL

SELECT 
  '📝 BUSINESS PROFILE (business_profile)' as "Data Source",
  jsonb_build_object(
    'short_description', bp.short_description,
    'long_description', bp.long_description,
    'price_level', bp.price_level,
    'target_audience', bp.target_audience
  ) as "Data",
  CASE 
    WHEN bp.business_id IS NOT NULL THEN 'HAS DATA ✅'
    ELSE 'EMPTY ❌'
  END as "Status"
FROM business_profile bp
CROSS JOIN cafe
WHERE bp.business_id = cafe.id;


-- STEP 3: SIMULATED AI PROMPT - What will actually be sent to Gemini
-- ============================================================================
WITH cafe AS (
  SELECT id FROM businesses 
  WHERE owner_id = auth.uid() 
  AND (name ILIKE '%faust%' OR name ILIKE '%test%')
  LIMIT 1
)
SELECT 
  '🤖 ACTUAL AI PROMPT BUSINESS CONTEXT' as "Prompt Section",
  'BUSINESS CONTEXT:' || E'\n' ||
  '- Name: ' || COALESCE(b.name, '❌ MISSING') || E'\n' ||
  '- Type: ' || COALESCE(b.category, '❌ MISSING') || E'\n' ||
  '- Location: ' || COALESCE(bl.city || ', ', '❌ No city, ') || COALESCE(b.country, '❌ MISSING') || E'\n' ||
  CASE 
    WHEN bp.values IS NOT NULL AND array_length(bp.values, 1) > 0 
    THEN '- Values: ' || array_to_string(bp.values, ', ') || E'\n'
    ELSE '- Values: ❌ MISSING' || E'\n'
  END ||
  CASE 
    WHEN bp.certifications IS NOT NULL AND array_length(bp.certifications, 1) > 0 
    THEN '- Certifications: ' || array_to_string(bp.certifications, ', ') || E'\n'
    ELSE '- Certifications: ❌ MISSING' || E'\n'
  END as "Exact Prompt Text"
FROM businesses b
CROSS JOIN cafe
LEFT JOIN business_brand_profile bp ON b.id = bp.business_id
LEFT JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
WHERE b.id = cafe.id;


-- STEP 4: IDENTIFY OLD/UNUSED TABLES (Cleanup Check)
-- ============================================================================
SELECT 
  table_name as "Table Name",
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = 'public' 
   AND columns.table_name = tables.table_name) as "Column Count",
  CASE 
    WHEN table_name IN ('businesses', 'business_brand_profile', 'business_locations', 'menu_items') 
    THEN '🟢 ACTIVE (Used in production)'
    WHEN table_name IN ('business_profile', 'business_team_members', 'social_accounts', 'opening_hours')
    THEN '🟡 LEGACY (Check if used)'
    ELSE '⚪ UNKNOWN (Review needed)'
  END as "Status Notes"
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND (
    table_name LIKE '%business%' 
    OR table_name LIKE '%brand%'
    OR table_name LIKE '%profile%'
  )
ORDER BY table_name;


-- ============================================================================
-- INTERPRETATION GUIDE:
-- ============================================================================
-- Step 1: Shows your business ID and basic info
-- Step 2: Shows what tables have data vs empty (✅ vs ❌)
-- Step 3: Shows EXACTLY what AI will see in the prompt
-- Step 4: Lists business-related tables to identify cleanup candidates

-- About Cleanup:
-- - 🟢 Tables marked ACTIVE are definitely used
-- - 🟡 Tables marked LEGACY might be old/unused
-- - ⚪ Tables marked UNKNOWN need review
-- 
-- Safe to clean up later - focus on testing AI functionality first!
