-- Check actual schema for all tables used in Layer tests

-- 1. BUSINESSES table
SELECT 
  '=== BUSINESSES TABLE COLUMNS ===' as section;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'businesses'
ORDER BY ordinal_position;

-- 2. BUSINESS_OPERATIONS table
SELECT 
  '=== BUSINESS_OPERATIONS TABLE COLUMNS ===' as section;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_operations'
ORDER BY ordinal_position;

-- 3. BUSINESS_LOCATION_INTELLIGENCE table
SELECT 
  '=== BUSINESS_LOCATION_INTELLIGENCE TABLE COLUMNS ===' as section;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_location_intelligence'
ORDER BY ordinal_position;

-- 4. BUSINESS_CONCEPT_FIT table
SELECT 
  '=== BUSINESS_CONCEPT_FIT TABLE COLUMNS ===' as section;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_concept_fit'
ORDER BY ordinal_position;

-- 5. BUSINESS_CONCEPT_FIT_MULTI table
SELECT 
  '=== BUSINESS_CONCEPT_FIT_MULTI TABLE COLUMNS ===' as section;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_concept_fit_multi'
ORDER BY ordinal_position;

-- 6. CONTEXTUAL_CALENDAR table
SELECT 
  '=== CONTEXTUAL_CALENDAR TABLE COLUMNS ===' as section;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'contextual_calendar'
ORDER BY ordinal_position;

-- 7. Sample data from businesses table for our test business
SELECT 
  '=== SAMPLE BUSINESSES DATA ===' as section;

SELECT *
FROM businesses
WHERE id = '840347de-9ba7-4275-8aa3-4553417fc2af';
