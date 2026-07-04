-- Drop existing suggested_posts table if it exists
-- This allows the next migration to create it with the correct schema

-- First drop all dependent objects
DROP TRIGGER IF EXISTS update_suggested_posts_updated_at ON public.suggested_posts;
DROP FUNCTION IF EXISTS update_suggested_posts_updated_at();
DROP FUNCTION IF EXISTS cleanup_old_archived_posts(integer);
DROP INDEX IF EXISTS idx_suggested_posts_user_id;
DROP INDEX IF EXISTS idx_suggested_posts_business_id;
DROP INDEX IF EXISTS idx_suggested_posts_status;
DROP INDEX IF EXISTS idx_suggested_posts_created_at;
DROP INDEX IF EXISTS idx_suggested_posts_platform;
DROP INDEX IF EXISTS idx_suggested_posts_published_lookup;

-- Then drop the table
DROP TABLE IF EXISTS public.suggested_posts CASCADE;
