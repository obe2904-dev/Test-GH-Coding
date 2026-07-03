-- Check if ANY strategy has timing_intelligence in post_ideas
SELECT
  id,
  week_number,
  week_start,
  jsonb_array_length(post_ideas) as post_count,
  (post_ideas->0->'timing_intelligence') IS NOT NULL as first_has_timing,
  post_ideas->0->'timing_intelligence' as first_timing_data,
  generated_at
FROM weekly_strategies
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
ORDER BY generated_at DESC
LIMIT 5;
