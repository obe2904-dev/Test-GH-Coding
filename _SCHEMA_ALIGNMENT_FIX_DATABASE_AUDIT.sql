-- =====================================================
-- DATABASE AUDIT: Website Analysis Schema Alignment
-- =====================================================
-- Purpose: Verify current state of data before/after schema fixes
-- Run this on production to assess impact and validate fixes
-- =====================================================

-- PHASE 1: Current Data Population Assessment
-- =====================================================

SELECT 
  '=== OVERALL DATA POPULATION ===' AS section,
  COUNT(*) as total_businesses,
  COUNT(bp.user_about_text) as has_about_text,
  COUNT(bp.keywords) as has_keywords,
  COUNT(bp.key_offerings) as has_key_offerings,
  COUNT(bp.long_description) as has_long_description,
  COUNT(bp.menu_signal) as has_menu_signal,
  COUNT(bp.booking_url) as has_booking_url,
  COUNT(bbp.tone_of_voice) as has_tone_in_brand_profile,
  COUNT(wsr.id) as has_scrape_results
FROM businesses b
LEFT JOIN business_profile bp ON b.id = bp.business_id
LEFT JOIN business_brand_profile bbp ON b.id = bbp.business_id
LEFT JOIN website_scrape_results wsr ON b.id = wsr.business_id;

-- PHASE 2: Field Type Verification
-- =====================================================

SELECT 
  '=== SCHEMA VERIFICATION ===' AS section,
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name IN ('business_profile', 'business_brand_profile', 'business_operations')
  AND column_name IN (
    'keywords', 'business_keywords', 
    'key_offerings', 
    'brand_tone', 'tone_of_voice',
    'user_about_text', 'long_description',
    'has_table_service', 'has_takeaway', 'has_delivery', 'has_outdoor_seating'
  )
ORDER BY table_name, column_name;

-- PHASE 3: Recent Website Analysis Activity
-- =====================================================

SELECT 
  '=== RECENT SCRAPE ACTIVITY ===' AS section,
  business_id,
  scraped_at,
  content_quality,
  menu_source,
  scraper_version,
  (extracted_data IS NOT NULL) as has_ai_extraction,
  (extracted_data::text LIKE '%error%') as has_extraction_error
FROM website_scrape_results
WHERE scraped_at > NOW() - INTERVAL '7 days'
ORDER BY scraped_at DESC
LIMIT 20;

-- PHASE 4: Businesses with Incomplete Profiles
-- =====================================================

SELECT 
  '=== INCOMPLETE PROFILES ===' AS section,
  b.id,
  b.name,
  (bp.user_about_text IS NOT NULL) as has_about,
  (bp.keywords IS NOT NULL) as has_keywords,
  (bp.key_offerings IS NOT NULL) as has_offerings,
  (bp.booking_url IS NOT NULL) as has_booking,
  (bbp.tone_of_voice IS NOT NULL) as has_tone,
  b.last_scraped_at
FROM businesses b
LEFT JOIN business_profile bp ON b.id = bp.business_id
LEFT JOIN business_brand_profile bbp ON b.id = bbp.business_id
WHERE b.website_url IS NOT NULL
  AND (
    bp.user_about_text IS NULL OR
    bp.keywords IS NULL OR
    bp.key_offerings IS NULL OR
    bbp.tone_of_voice IS NULL
  )
ORDER BY b.last_scraped_at DESC NULLS LAST
LIMIT 20;

-- PHASE 5: Test Businesses for Validation
-- =====================================================

SELECT 
  '=== SUGGESTED TEST BUSINESSES ===' AS section,
  b.id,
  b.name,
  b.website_url,
  wsr.content_quality,
  wsr.scraped_at as last_scraped,
  bp.user_about_text IS NOT NULL as has_data
FROM businesses b
LEFT JOIN website_scrape_results wsr ON b.id = wsr.business_id
LEFT JOIN business_profile bp ON b.id = bp.business_id
WHERE b.website_url IS NOT NULL
  AND wsr.scraped_at IS NOT NULL
ORDER BY 
  CASE wsr.content_quality
    WHEN 'rich' THEN 1
    WHEN 'thin' THEN 2
    WHEN 'shell' THEN 3
    ELSE 4
  END,
  wsr.scraped_at DESC
LIMIT 10;

-- PHASE 6: Keywords Data Type Check
-- =====================================================

SELECT 
  '=== KEYWORDS DATA SAMPLE ===' AS section,
  b.name,
  bp.keywords,
  jsonb_typeof(to_jsonb(bp.keywords)) as keywords_type,
  array_length(bp.keywords, 1) as keyword_count
FROM businesses b
JOIN business_profile bp ON b.id = bp.business_id
WHERE bp.keywords IS NOT NULL
LIMIT 10;

-- PHASE 7: Key Offerings Format Check
-- =====================================================

SELECT 
  '=== KEY OFFERINGS FORMAT ===' AS section,
  b.name,
  bp.key_offerings,
  length(bp.key_offerings) as text_length,
  (bp.key_offerings LIKE '%\n%') as has_newlines,
  (bp.key_offerings LIKE '%[%') as looks_like_json
FROM businesses b
JOIN business_profile bp ON b.id = bp.business_id
WHERE bp.key_offerings IS NOT NULL
LIMIT 10;

-- =====================================================
-- VALIDATION QUERIES (Run after deployment)
-- =====================================================

-- Check: Were keywords saved correctly after fix?
-- Expected: Should see TEXT[] array data, not NULL
SELECT COUNT(*) as businesses_with_keywords_after_fix
FROM business_profile
WHERE keywords IS NOT NULL
  AND updated_at > '2026-07-15'::date;

-- Check: Was tone saved to correct table?
-- Expected: Should see entries in business_brand_profile
SELECT COUNT(*) as businesses_with_tone_after_fix
FROM business_brand_profile
WHERE tone_of_voice IS NOT NULL
  AND updated_at > '2026-07-15'::date;

-- Check: Are key_offerings formatted as TEXT?
-- Expected: Should see newline-separated text, not JSON arrays
SELECT 
  key_offerings,
  (key_offerings LIKE '%\n%') as properly_formatted
FROM business_profile
WHERE key_offerings IS NOT NULL
  AND updated_at > '2026-07-15'::date
LIMIT 5;
