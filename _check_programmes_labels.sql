-- Check what programme labels Café Faust has (for persona validation)
SELECT 
  programme_type,
  programme_label,
  time_window_start,
  time_window_end,
  created_at
FROM business_programmes
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY time_window_start;
