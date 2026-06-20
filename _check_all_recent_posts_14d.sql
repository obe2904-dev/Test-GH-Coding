-- Check all recent posts in last 14 days
SELECT 
  menu_item_name,
  posted_at,
  ROUND(EXTRACT(EPOCH FROM (NOW() - posted_at))/86400) AS days_ago,
  platform
FROM published_posts
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND posted_at >= NOW() - INTERVAL '14 days'
  AND status = 'published'
  AND menu_item_name IS NOT NULL
ORDER BY posted_at DESC;
