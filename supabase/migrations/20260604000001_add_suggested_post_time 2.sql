-- Migration: Add suggested_post_time column to published_posts
-- Date: 2026-06-04
-- Purpose: Store the AI-recommended posting time from Quick Suggestions
--          so it follows the post from "AI Ideas" → "Design" → "Udgiv"

-- Add suggested_post_time column
ALTER TABLE published_posts 
  ADD COLUMN IF NOT EXISTS suggested_post_time TIME;

-- Add comment explaining the purpose
COMMENT ON COLUMN published_posts.suggested_post_time IS 
  'AI-recommended posting time from Quick Suggestions (e.g., 17:00). Preserved through draft → scheduled → published workflow to show user the optimal posting time.';

-- Create index for filtering by suggested time (optional, for analytics)
CREATE INDEX IF NOT EXISTS idx_published_posts_suggested_time
  ON published_posts(suggested_post_time)
  WHERE suggested_post_time IS NOT NULL AND idea_source = 'quick_suggestions';
