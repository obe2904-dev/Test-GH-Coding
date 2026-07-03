-- Query menu_results_v2 and ai_summary for the two businesses to understand brand-building potential
-- Business IDs:
-- 02765409-46b9-4287-808f-21cf9d631f86
-- 1a285371-64f7-4def-b248-2e8cdfbba106

SELECT 
  business_id,
  id,
  service_period_name,
  menu_type,
  language_code,
  ai_summary,
  LENGTH(ai_summary) as summary_length,
  source_url,
  status,
  created_at
FROM menu_results_v2
WHERE business_id IN (
  '02765409-46b9-4287-808f-21cf9d631f86',
  '1a285371-64f7-4def-b248-2e8cdfbba106'
)
AND status = 'done'
ORDER BY business_id, service_period_name;
