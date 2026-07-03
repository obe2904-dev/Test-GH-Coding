-- Check for ai_summary data in menu_results_v2
-- User reports 7 rows exist

SELECT 
  id,
  business_id,
  service_period_name,
  LENGTH(ai_summary) as summary_length,
  LEFT(ai_summary, 100) as summary_preview
FROM menu_results_v2
WHERE ai_summary IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
