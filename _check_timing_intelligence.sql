-- Check if timing intelligence was applied to post ideas
SELECT
  id,
  week_number,
  week_start,
  jsonb_array_length(post_ideas) as post_count,
  jsonb_pretty(post_ideas->0->'timing_intelligence') as first_post_timing,
  post_ideas->0->>'title' as first_post_title,
  post_ideas->0->>'suggested_day' as first_post_day,
  post_ideas->0->'timing_intelligence'->>'suggested_post_time' as first_post_time,
  post_ideas->0->'timing_intelligence'->>'timing_rationale' as first_post_rationale
FROM weekly_strategies
WHERE business_id = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'
  AND week_number = 26
ORDER BY generated_at DESC
LIMIT 1;
