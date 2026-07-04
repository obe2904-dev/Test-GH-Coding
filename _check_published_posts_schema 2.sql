-- Check 1: Which columns actually exist in published_posts
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'published_posts'
ORDER BY ordinal_position;

-- Check 2: Recent rows (most recent first)
SELECT id, business_id, platform, source, posted_at, published_at, created_at,
       LEFT(post_text, 40) AS post_text_preview
FROM published_posts
ORDER BY created_at DESC
LIMIT 10;

-- Check 3: RLS policies on the table
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'published_posts';
