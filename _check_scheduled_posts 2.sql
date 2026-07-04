-- Check what was recently saved to published_posts
SELECT id, platform, status, scheduled_for, posted_at, post_text
FROM published_posts
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
ORDER BY created_at DESC
LIMIT 10;
