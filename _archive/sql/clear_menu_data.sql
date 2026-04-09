-- Clear all existing menu data to start fresh
-- Run this in Supabase SQL Editor

-- Check what exists
SELECT 
  'menu_sources' as table_name, 
  COUNT(*) as count 
FROM menu_sources
UNION ALL
SELECT 
  'menu_results_v2' as table_name, 
  COUNT(*) as count 
FROM menu_results_v2
UNION ALL
SELECT 
  'menu_extractions' as table_name, 
  COUNT(*) as count 
FROM menu_extractions;

-- UNCOMMENT TO DELETE ALL MENU DATA:
-- DELETE FROM menu_results_v2;
-- DELETE FROM menu_sources;
-- DELETE FROM menu_extractions;
