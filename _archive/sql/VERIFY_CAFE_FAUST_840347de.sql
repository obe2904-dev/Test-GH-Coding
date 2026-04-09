-- ============================================================================
-- CAFÉ FAUST DATA VERIFICATION
-- Business ID: 840347de-9ba7-4275-8aa3-4553417fc2af
-- ============================================================================

-- Query 1: BUSINESS INFO
-- ============================================================================
SELECT 
  'BUSINESS TABLE' as "Source",
  name,
  category,
  country,
  vertical,
  website_url,
  primary_language
FROM businesses
WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af';


-- Query 2: BRAND PROFILE (Used in AI Prompts)
-- ============================================================================
SELECT 
  'BRAND PROFILE TABLE' as "Source",
  tone_keywords,
  values,
  certifications,
  voice_style,
  do_not_say,
  business_voice,
  cta_preference,
  booking_link
FROM business_brand_profile
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';


-- Query 3: LOCATION INFO
-- ============================================================================
SELECT 
  'LOCATION TABLE' as "Source",
  city,
  address_line1,
  postal_code,
  country,
  is_primary
FROM business_locations
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';


-- Query 4: EXACT AI PROMPT - What Gemini Will Receive
-- ============================================================================
SELECT 
  '🤖 AI PROMPT BUSINESS CONTEXT' as "Section",
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
  END as "Exact Prompt Text",
  
  -- Additional info
  CASE 
    WHEN bp.tone_keywords IS NOT NULL THEN array_to_string(bp.tone_keywords, ', ')
    ELSE 'No tone keywords'
  END as "Tone Keywords",
  
  CASE 
    WHEN bp.voice_style IS NOT NULL THEN bp.voice_style
    ELSE 'No voice style'
  END as "Voice Style",
  
  CASE 
    WHEN bp.do_not_say IS NOT NULL THEN bp.do_not_say::text
    ELSE 'No banned words'
  END as "Banned Words"

FROM businesses b
LEFT JOIN business_brand_profile bp ON b.id = bp.business_id
LEFT JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';


-- Query 5: MISSING DATA CHECK
-- ============================================================================
SELECT 
  'Data Completeness Check' as "Check",
  CASE WHEN b.name IS NOT NULL THEN '✅' ELSE '❌' END as "Has Name",
  CASE WHEN b.category IS NOT NULL THEN '✅' ELSE '❌' END as "Has Category",
  CASE WHEN b.country IS NOT NULL THEN '✅' ELSE '❌' END as "Has Country",
  CASE WHEN bl.city IS NOT NULL THEN '✅' ELSE '❌' END as "Has City",
  CASE WHEN bp.values IS NOT NULL AND array_length(bp.values, 1) > 0 THEN '✅' ELSE '❌' END as "Has Values",
  CASE WHEN bp.certifications IS NOT NULL AND array_length(bp.certifications, 1) > 0 THEN '✅' ELSE '❌' END as "Has Certifications",
  CASE WHEN bp.tone_keywords IS NOT NULL AND array_length(bp.tone_keywords, 1) > 0 THEN '✅' ELSE '❌' END as "Has Tone",
  CASE WHEN bp.voice_style IS NOT NULL THEN '✅' ELSE '❌' END as "Has Voice Style",
  CASE WHEN bp.do_not_say IS NOT NULL THEN '✅' ELSE '❌' END as "Has Banned Words"
FROM businesses b
LEFT JOIN business_brand_profile bp ON b.id = bp.business_id
LEFT JOIN business_locations bl ON b.id = bl.business_id AND bl.is_primary = true
WHERE b.id = '840347de-9ba7-4275-8aa3-4553417fc2af';


-- Query 6: MENU ITEMS (For Content Generation)
-- ============================================================================
SELECT 
  'MENU DATA' as "Source",
  COUNT(*) as "Total Menu Extractions",
  COUNT(CASE WHEN extracted_data IS NOT NULL THEN 1 END) as "Extractions with Items",
  jsonb_array_length(
    COALESCE(
      (SELECT jsonb_agg(item) 
       FROM menu_extractions me, 
       jsonb_array_elements(me.extracted_data -> 'items') item 
       WHERE me.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'),
      '[]'::jsonb
    )
  ) as "Total Menu Items Across All Menus"
FROM menu_extractions
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';


-- Query 6b: MENU ITEM DETAILS (Sample)
-- ============================================================================
SELECT 
  'MENU ITEMS SAMPLE' as "Info",
  me.menu_name,
  jsonb_array_length(me.extracted_data -> 'items') as "Items in This Menu",
  me.extracted_data -> 'items' -> 0 ->> 'name' as "Sample Item Name",
  me.extracted_data -> 'items' -> 0 ->> 'description' as "Sample Description",
  me.extracted_data -> 'items' -> 0 ->> 'category' as "Sample Category"
FROM menu_extractions me
WHERE me.business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
  AND me.extracted_data IS NOT NULL
LIMIT 3;


-- ============================================================================
-- QUICK SUMMARY:
-- ============================================================================
-- Query 1: Shows raw business data
-- Query 2: Shows raw brand profile data (arrays and JSONB)
-- Query 3: Shows location data
-- Query 4: Shows EXACT text that goes into AI prompt
-- Query 5: Shows ✅/❌ for each required field
-- Query 6: Shows menu item count (needed for content generation)
