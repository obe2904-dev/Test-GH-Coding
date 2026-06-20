-- Debug query: Check the actual generated post draft
SELECT 
  id,
  post_text,
  suggestion_id,
  platforms,
  content_json,
  created_at
FROM post_drafts
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND (
    post_text ILIKE '%FALAFEL%'
    OR post_text ILIKE '%omelet%'
  )
ORDER BY created_at DESC
LIMIT 3;
