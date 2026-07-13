-- ============================================================================
-- DIAGNOSTIC QUERIES: Week 19 Mors Dag Failure Analysis
-- ============================================================================
-- Run these in Supabase SQL Editor to understand what went wrong
-- https://supabase.com/dashboard/project/zzauefccejjkdguuyapl/sql
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0A. DISCOVER ALL TABLES IN DATABASE
-- ────────────────────────────────────────────────────────────────────────────
SELECT 
  'ALL TABLES' as section,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ────────────────────────────────────────────────────────────────────────────
-- 0B. CHECK ACTUAL COLUMN NAMES IN daily_suggestions
-- ────────────────────────────────────────────────────────────────────────────
SELECT 
  'SCHEMA: daily_suggestions columns' as section,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'daily_suggestions'
ORDER BY ordinal_position;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. CHECK WHAT WAS ACTUALLY GENERATED AND STORED
-- ────────────────────────────────────────────────────────────────────────────
-- NOTE: Using * first to see all columns, then will filter based on actual schema
SELECT 
  'GENERATED POSTS FOR WEEK 19' as section,
  *
FROM daily_suggestions
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
  AND created_at::date BETWEEN '2026-05-03' AND '2026-05-10'
ORDER BY created_at
LIMIT 20;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. CHECK BUSINESS ARCHETYPE AND COUNTRY CODE
-- ────────────────────────────────────────────────────────────────────────────
SELECT 
  'BUSINESS CONFIG' as section,
  id,
  name,
  archetype,
  country_code,
  category
FROM businesses
WHERE id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. CHECK MENU/DISHES TABLE (name might be dishes, menu_items, or menu)
-- ────────────────────────────────────────────────────────────────────────────
-- First discover the table name
SELECT 
  'MENU/DISH TABLE SEARCH' as section,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%menu%' 
    OR table_name ILIKE '%dish%'
    OR table_name ILIKE '%item%'
  );

-- Try common table names - comment out if table doesn't exist
-- SELECT 'dishes' as table_name, * FROM dishes 
-- WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f' LIMIT 5;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. CHECK EVENT TABLE (might be events, calendar_events, or holidays)
-- ────────────────────────────────────────────────────────────────────────────
SELECT 
  'EVENT TABLE SEARCH' as section,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%event%' 
    OR table_name ILIKE '%holiday%'
    OR table_name ILIKE '%calendar%'
  );

-- Try common table names - uncomment the one that exists
-- SELECT 'events' as table_name, * FROM events 
-- WHERE date BETWEEN '2026-05-04' AND '2026-05-10' LIMIT 10;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. CHECK WEEKLY STRATEGY TABLE
-- ────────────────────────────────────────────────────────────────────────────
SELECT 
  'STRATEGY TABLE SEARCH' as section,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name ILIKE '%strat%';

-- Check if weekly_strategies table exists and has data
-- SELECT 'weekly_strategies' as table_name, * FROM weekly_strategies 
-- WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
-- ORDER BY created_at DESC LIMIT 5;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. SKIP - query removed
-- ────────────────────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────────────────────
-- 7. CHECK IF VALIDATION RESULT WAS STORED (if validation_result column exists)
-- ────────────────────────────────────────────────────────────────────────────
SELECT 
  'VALIDATION DETAILS' as section,
  *
FROM daily_suggestions
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
  AND created_at::date BETWEEN '2026-05-03' AND '2026-05-10'
  AND validation_result IS NOT NULL
ORDER BY created_at
LIMIT 10;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. CHECK SCHEMA COLUMNS EXIST
-- ────────────────────────────────────────────────────────────────────────────
SELECT 
  'SCHEMA VERIFICATION' as section,
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('daily_suggestions', 'businesses', 'business_operations')
  AND column_name IN (
    'archetype', 'country_code', 
    'validation_result', 'inferred_content_type',
    'programme_archetype', 'holiday_context',
    'goal_mode', 'content_category'
  )
ORDER BY table_name, column_name;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. FULL POST DETAIL FOR "TAPAS AT 9AM" ABSURDITY
-- ────────────────────────────────────────────────────────────────────────────
SELECT 
  'TAPAS AT 9AM DETAIL' as section,
  *
FROM daily_suggestions
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
  AND title ILIKE '%tapas%'
  AND created_at::date BETWEEN '2026-05-03' AND '2026-05-10';

-- ────────────────────────────────────────────────────────────────────────────
-- 10. CHECK IF holiday_context FIELD EXISTS IN SCHEMA
-- ────────────────────────────────────────────────────────────────────────────
SELECT 
  'HOLIDAY_CONTEXT FIELD CHECK' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'daily_suggestions'
  AND column_name = 'holiday_context';
