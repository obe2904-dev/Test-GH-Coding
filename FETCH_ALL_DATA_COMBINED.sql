-- Fetch ALL data for a business in separate result sets
-- Replace 'YOUR_BUSINESS_ID' with actual business ID

-- Query 1: Opening hours (7 rows)
SELECT * FROM opening_hours 
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY 
  CASE weekday
    WHEN 'monday' THEN 1
    WHEN 'tuesday' THEN 2
    WHEN 'wednesday' THEN 3
    WHEN 'thursday' THEN 4
    WHEN 'friday' THEN 5
    WHEN 'saturday' THEN 6
    WHEN 'sunday' THEN 7
  END;

-- Query 2: Menu sources (6 rows)
SELECT * FROM menu_sources
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY created_at DESC;

-- Query 3: Extracted menu data (3 rows)
SELECT 
  id,
  business_id,
  source_url,
  source_kind,
  LEFT(raw_text, 500) as raw_text_preview,
  structured_data,
  status,
  extraction_method,
  created_at
FROM menu_results_v2
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af'
ORDER BY created_at DESC;

-- Query 4: Business profile
SELECT * FROM business_profile
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';

-- Query 5: Operations data
SELECT * FROM business_operations
WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';
