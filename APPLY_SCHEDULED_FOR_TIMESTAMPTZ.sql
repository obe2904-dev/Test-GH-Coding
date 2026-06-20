-- Widen scheduled_for from DATE to TIMESTAMPTZ so the hour/minute of a scheduled post is preserved.
-- Safe to run multiple times (ALTER TYPE USING cast is idempotent when already TIMESTAMPTZ).
-- Run in: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new

ALTER TABLE published_posts
  ALTER COLUMN scheduled_for TYPE TIMESTAMPTZ
  USING scheduled_for::TIMESTAMPTZ;

COMMENT ON COLUMN published_posts.scheduled_for IS
  'Full datetime (with timezone) when the post is scheduled to go out. NULL for immediate/published posts.';

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'published_posts'
  AND column_name = 'scheduled_for';
-- Expected: data_type = 'timestamp with time zone'
