-- Check Phase C activation for latest Cafe Faust strategy
SELECT
  id,
  status,
  created_at,
  week_start,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(post_ideas) AS post
    WHERE post->>'content_type' IS NOT NULL
  ) AS posts_with_content_type,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(post_ideas) AS post
    WHERE post->>'type_rationale' IS NOT NULL
  ) AS posts_with_type_rationale,
  jsonb_array_length(post_ideas) AS total_posts,
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'content_type', post->>'content_type',
        'content_category', post->>'content_category',
        'goal_mode', post->>'goal_mode',
        'title', post->>'title'
      )
    )
    FROM jsonb_array_elements(post_ideas) AS post
  ) AS post_summary
FROM weekly_strategies
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND week_start = '2026-06-08'
ORDER BY created_at DESC
LIMIT 1;
