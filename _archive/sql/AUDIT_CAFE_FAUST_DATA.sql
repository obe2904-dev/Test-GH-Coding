-- ============================================================================
-- COMPLETE DATA AUDIT: What data does Café Faust actually have?
-- Business ID: 840347de-9ba7-4275-8aa3-4553417fc2af
-- User ID: 04b868f4-7a8d-402c-a60a-d089bf9013e1
-- ============================================================================

-- Query 1: Raw business_brand_profile data
-- ============================================================================
SELECT 
  'BRAND PROFILE RAW DATA' as "Source",
  tone_keywords,
  voice_style,
  values,
  certifications,
  do_not_say,
  created_at,
  updated_at
FROM business_brand_profile
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';


-- Query 2: Check if content_style page data exists in a different table
-- ============================================================================
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name ILIKE '%voice%' 
   OR column_name ILIKE '%tone%'
   OR column_name ILIKE '%style%'
   OR column_name ILIKE '%brand%'
ORDER BY table_name, column_name;


-- Query 3: Check ALL tables that reference this business_id
-- ============================================================================
SELECT 
  'businesses' as table_name,
  COUNT(*) as records
FROM businesses
WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af'

UNION ALL

SELECT 
  'business_brand_profile' as table_name,
  COUNT(*) as records
FROM business_brand_profile
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'

UNION ALL

SELECT 
  'business_profile' as table_name,
  COUNT(*) as records
FROM business_profile
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'

UNION ALL

SELECT 
  'business_locations' as table_name,
  COUNT(*) as records
FROM business_locations
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'

UNION ALL

SELECT 
  'menu_results_v2' as table_name,
  COUNT(*) as records
FROM menu_results_v2
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';


-- Query 4: What columns does business_brand_profile actually have?
-- ============================================================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'business_brand_profile'
ORDER BY ordinal_position;
