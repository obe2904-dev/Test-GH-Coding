-- ============================================================
-- VERIFY: Check suggested_post_time column was added
-- ============================================================

-- 1. Verify column exists
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'published_posts'
  AND column_name = 'suggested_post_time';

-- Expected: 1 row with data_type = 'time without time zone'

-- 2. Verify index was created
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'published_posts'
  AND indexname = 'idx_published_posts_suggested_time';

-- Expected: 1 row showing the index

-- 3. Test inserting a draft with suggested time
INSERT INTO published_posts (
  business_id,
  user_id,
  status,
  idea_source,
  content_type,
  post_text,
  scheduled_for,
  suggested_post_time,
  source
) VALUES (
  'f4679fa9-3120-4a59-9506-d059b010c34a',
  '00000000-0000-0000-0000-000000000000',
  'draft',
  'quick_suggestions',
  'menu_item',
  'Test post with suggested time',
  CURRENT_DATE,
  '17:00:00',
  'quick_suggestions'
)
RETURNING id, status, scheduled_for, suggested_post_time;

-- Expected: New row with suggested_post_time = 17:00:00

-- 4. Clean up test row
DELETE FROM published_posts 
WHERE business_id = 'f4679fa9-3120-4a59-9506-d059b010c34a'
  AND post_text = 'Test post with suggested time';
