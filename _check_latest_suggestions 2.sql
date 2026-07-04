-- Check latest suggestions for K BBQ
SELECT 
  id,
  position,
  title,
  content_type,
  status,
  suggested_time,
  menu_item_name,
  date,
  created_at
FROM daily_suggestions
WHERE business_id = '64ece273-bca0-4410-8cf9-2678d8bfaf20'
  AND date = '2026-06-25'
  AND source = 'quick_suggestions'
ORDER BY position ASC;
