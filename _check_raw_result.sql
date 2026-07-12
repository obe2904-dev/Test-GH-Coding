-- Check the raw_result JSON from website_analyses for Souk Aarhus
SELECT 
  business_id,
  jsonb_pretty(raw_result) as raw_result_pretty,
  created_at
FROM website_analyses
WHERE business_id = '450c1b6a-e354-4eef-88d8-86cd2ac8d42b'
ORDER BY created_at DESC
LIMIT 1;
