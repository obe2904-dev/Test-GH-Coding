-- ============================================================================
-- SIMPLE CHECK: See if Weekly Plan generated posts
-- ============================================================================
-- Purpose: Quick check if posts were created for Week 25

-- Check weekly_strategies table
SELECT 
  'Weekly Strategy Check' as test_name,
  id,
  week_start,
  status,
  generated_at,
  LENGTH(post_ideas::text) as post_ideas_size,
  jsonb_array_length(post_ideas) as post_count
FROM weekly_strategies
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND week_start = '2026-06-08'::date
ORDER BY generated_at DESC
LIMIT 1;

-- Check published_posts table for Week 25
SELECT 
  'Published Posts Week 25' as test_name,
  COUNT(*) as total_posts,
  STRING_AGG(DISTINCT TO_CHAR(scheduled_for, 'Dy'), ', ' ORDER BY TO_CHAR(scheduled_for, 'Dy')) as days_used,
  MIN(scheduled_for)::date as first_post,
  MAX(scheduled_for)::date as last_post
FROM published_posts
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND scheduled_for >= '2026-06-08'::date
  AND scheduled_for < '2026-06-15'::date
  AND status != 'deleted';

-- If posts exist, show them
SELECT 
  scheduled_for::date as post_date,
  TO_CHAR(scheduled_for, 'Dy') as day,
  EXTRACT(DOW FROM scheduled_for) as dow,
  LEFT(title, 50) as title_preview,
  status
FROM published_posts
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND scheduled_for >= '2026-06-08'::date
  AND scheduled_for < '2026-06-15'::date
  AND status != 'deleted'
ORDER BY scheduled_for;
