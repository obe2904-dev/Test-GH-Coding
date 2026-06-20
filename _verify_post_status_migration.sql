-- Verify the status tracking migration
-- Run this after applying 20260603000001_add_post_status_tracking.sql

-- 1. Check all new columns exist
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'published_posts'
  AND column_name IN ('status', 'scheduled_for', 'idea_source', 'suggestion_id', 'caption_data', 'media_metadata')
ORDER BY column_name;

-- Expected result: 6 rows

-- 2. Check all existing posts have status = 'published'
SELECT 
  COUNT(*) AS total_posts,
  COUNT(*) FILTER (WHERE status = 'published') AS published_status,
  COUNT(*) FILTER (WHERE status IS NULL) AS null_status
FROM published_posts;

-- Expected: total_posts = published_status, null_status = 0

-- 3. Verify CHECK constraints
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.published_posts'::regclass
  AND contype = 'c'
  AND conname LIKE '%status%' OR conname LIKE '%idea_source%';

-- Expected: status CHECK and idea_source CHECK constraints

-- 4. Verify indexes were created
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'published_posts'
  AND (indexname LIKE '%status%' OR indexname LIKE '%idea%' OR indexname LIKE '%scheduled%');

-- Expected: 3 new indexes

-- 5. Test inserting a draft
INSERT INTO published_posts (
  business_id,
  user_id,
  status,
  idea_source,
  content_type,
  post_text,
  scheduled_for,
  source
) 
SELECT 
  id AS business_id,
  user_id,
  'draft' AS status,
  'quick_suggestions' AS idea_source,
  'menu_item' AS content_type,
  'Test draft post' AS post_text,
  CURRENT_DATE + 1 AS scheduled_for,
  'manual_copy_paste' AS source
FROM businesses
LIMIT 1
RETURNING id, status, scheduled_for, idea_source;

-- If successful, delete the test record
-- DELETE FROM published_posts WHERE post_text = 'Test draft post';

-- 6. Test status transition: draft → scheduled → published
-- (This is a dry-run test - remove the ROLLBACK to actually apply)
BEGIN;

WITH test_draft AS (
  INSERT INTO published_posts (
    business_id,
    user_id,
    status,
    idea_source,
    content_type,
    post_text,
    source
  ) 
  SELECT 
    id,
    user_id,
    'draft',
    'manual',
    'atmosphere',
    'Test workflow',
    'manual_copy_paste'
  FROM businesses
  LIMIT 1
  RETURNING id
),
scheduled AS (
  UPDATE published_posts
  SET status = 'scheduled', scheduled_for = CURRENT_DATE + 2
  WHERE id = (SELECT id FROM test_draft)
  RETURNING id, status, scheduled_for
),
published AS (
  UPDATE published_posts
  SET status = 'published', posted_at = NOW(), published_at = NOW()
  WHERE id = (SELECT id FROM test_draft)
  RETURNING id, status, posted_at
)
SELECT * FROM published;

ROLLBACK;  -- Remove this line to keep the test data

-- 7. Verify all status values are valid
SELECT DISTINCT status
FROM published_posts
ORDER BY status;

-- Expected: Only 'draft', 'scheduled', 'published' (and possibly NULL if migration failed)

-- 8. Check idea_source values
SELECT DISTINCT idea_source
FROM published_posts
ORDER BY idea_source;

-- Expected: Only 'manual', 'quick_suggestions', 'weekly_plan' (and possibly NULL)

-- 9. Full schema display
\d+ published_posts
