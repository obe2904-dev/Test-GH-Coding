-- Test the fixed function
SELECT record_text_generation(13);

-- Check the results
SELECT * FROM get_daily_usage_stats('f4679fa9-3120-4a59-9506-d059b010c34a');

-- View the updated suggestion
SELECT 
  id,
  title,
  text_generated_count,
  first_text_generated_at,
  last_text_generated_at
FROM daily_suggestions
WHERE id = 13;
