-- Check ALL menu-related tables for business 840347de-9ba7-4275-8aa3-4553417fc2af
-- ============================================================================

-- Table 1: menu_sources (PDF/URL sources)
SELECT 
  'MENU_SOURCES' as "Table",
  COUNT(*) as "Records",
  array_agg(source_type) as "Source Types",
  array_agg(status) as "Statuses"
FROM menu_sources
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Table 2: menu_results (processing queue - old?)
SELECT 
  'MENU_RESULTS' as "Table",
  COUNT(*) as "Records",
  array_agg(status) as "Statuses"
FROM menu_results
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Table 3: menu_results_v2 (processing queue - new?)
SELECT 
  'MENU_RESULTS_V2' as "Table",
  COUNT(*) as "Records",
  array_agg(status) as "Statuses"
FROM menu_results_v2
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Table 4: menu_extractions (extracted menu data)
SELECT 
  'MENU_EXTRACTIONS' as "Table",
  COUNT(*) as "Records",
  array_agg(menu_name) as "Menu Names",
  array_agg(menu_type) as "Menu Types"
FROM menu_extractions
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Table 5: menu_item_metadata (scored items)
SELECT 
  'MENU_ITEM_METADATA' as "Table",
  COUNT(*) as "Records"
FROM menu_item_metadata
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';


-- DETAILED INSPECTION: Show actual data from each table
-- ============================================================================

-- Detail 1: menu_sources (What was uploaded/provided)
SELECT 
  'MENU SOURCES DETAIL' as "Info",
  id,
  source_type,
  source_url,
  file_name,
  status,
  created_at
FROM menu_sources
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY created_at DESC;

-- Detail 2: menu_results_v2 (Latest processing status)
SELECT 
  'MENU RESULTS V2 DETAIL' as "Info",
  id,
  status,
  structured_data,
  error_message,
  created_at
FROM menu_results_v2
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY created_at DESC
LIMIT 5;

-- Detail 3: menu_extractions (Final extracted menu data)
SELECT 
  'MENU EXTRACTIONS DETAIL' as "Info",
  id,
  menu_name,
  menu_type,
  extracted_data,
  extracted_at
FROM menu_extractions
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY extracted_at DESC;
