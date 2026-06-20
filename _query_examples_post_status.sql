-- =====================================================
-- Query Examples for Updated published_posts Schema
-- After migration: 20260603000001_add_post_status_tracking.sql
-- =====================================================

-- ── DRAFT QUERIES ────────────────────────────────────────────

-- Get all drafts for a business
SELECT 
  id,
  status,
  idea_source,
  scheduled_for,
  content_type,
  LEFT(post_text, 50) AS preview,
  created_at,
  updated_at
FROM published_posts 
WHERE business_id = 'YOUR-BUSINESS-UUID' 
  AND status = 'draft'
ORDER BY created_at DESC;

-- Create a new draft from Quick Suggestion
INSERT INTO published_posts (
  business_id,
  user_id,
  status,
  idea_source,
  suggestion_id,
  content_type,
  post_text,
  caption_data,
  media_metadata,
  scheduled_for,
  source
) VALUES (
  'business-uuid',
  'user-uuid',
  'draft',
  'quick_suggestions',
  'suggestion-uuid',
  'menu_item',
  'Varm æggekage med...',
  '{"text": "...", "hashtags": ["#brunch", "#Copenhagen"]}'::jsonb,
  '{"photo_idea": "Close-up of warm egg dish"}'::jsonb,
  '2026-06-06',
  'quick_suggestions'
)
RETURNING id, status, scheduled_for;

-- ── SCHEDULED POST QUERIES ───────────────────────────────────

-- Get all scheduled posts for this week
SELECT 
  id,
  scheduled_for,
  content_type,
  LEFT(post_text, 50) AS preview,
  idea_source,
  platform
FROM published_posts 
WHERE business_id = 'YOUR-BUSINESS-UUID' 
  AND status = 'scheduled'
  AND scheduled_for >= CURRENT_DATE
  AND scheduled_for < CURRENT_DATE + INTERVAL '7 days'
ORDER BY scheduled_for, created_at;

-- Schedule a draft for future posting
UPDATE published_posts 
SET 
  status = 'scheduled',
  scheduled_for = '2026-06-06',
  updated_at = NOW()
WHERE id = 'draft-uuid'
  AND status = 'draft';

-- Get posts ready to publish today (for cron job)
-- Note: CURRENT_DATE filter applied at query time, not in index
SELECT 
  id,
  business_id,
  scheduled_for,
  post_text,
  platform
FROM published_posts 
WHERE status = 'scheduled'
  AND scheduled_for <= CURRENT_DATE
ORDER BY scheduled_for, created_at;

-- ── PUBLISHING QUERIES ───────────────────────────────────────

-- Publish a scheduled post (manual or cron)
UPDATE published_posts 
SET 
  status = 'published',
  posted_at = NOW(),
  published_at = NOW(),
  updated_at = NOW()
WHERE id = 'scheduled-post-uuid'
  AND status = 'scheduled'
RETURNING id, status, posted_at;

-- Publish a draft immediately (skip scheduling)
UPDATE published_posts 
SET 
  status = 'published',
  platform = 'facebook',
  posted_at = NOW(),
  published_at = NOW(),
  updated_at = NOW()
WHERE id = 'draft-uuid'
  AND status = 'draft'
RETURNING id, status, posted_at;

-- ── TIMELINE / CALENDAR QUERIES ──────────────────────────────

-- Full post timeline (all states) for a business
SELECT 
  id,
  status,
  COALESCE(scheduled_for, posted_at::date) AS target_date,
  content_type,
  LEFT(post_text, 50) AS preview,
  idea_source,
  created_at
FROM published_posts 
WHERE business_id = 'YOUR-BUSINESS-UUID'
ORDER BY 
  COALESCE(scheduled_for, posted_at::date) DESC,
  created_at DESC;

-- Weekly calendar view (scheduled + published this week)
SELECT 
  DATE(COALESCE(scheduled_for, posted_at::date)) AS post_date,
  status,
  COUNT(*) AS post_count,
  STRING_AGG(content_type, ', ') AS content_types
FROM published_posts 
WHERE business_id = 'YOUR-BUSINESS-UUID'
  AND COALESCE(scheduled_for, posted_at::date) >= CURRENT_DATE
  AND COALESCE(scheduled_for, posted_at::date) < CURRENT_DATE + INTERVAL '7 days'
GROUP BY post_date, status
ORDER BY post_date;

-- ── RECENCY FILTER QUERIES (Updated) ─────────────────────────

-- Get published posts for recency filter (avoid repeating within 14 days)
-- ⚠️ IMPORTANT: Now requires status = 'published' filter
SELECT 
  content_type,
  menu_item_name,
  posted_at
FROM published_posts 
WHERE business_id = 'YOUR-BUSINESS-UUID'
  AND status = 'published'  -- ← NEW: Must filter by status
  AND posted_at >= NOW() - INTERVAL '14 days'
ORDER BY posted_at DESC;

-- Check if menu item was posted recently (before suggesting it again)
SELECT EXISTS (
  SELECT 1 
  FROM published_posts
  WHERE business_id = 'YOUR-BUSINESS-UUID'
    AND status = 'published'  -- ← NEW: Only count published posts
    AND menu_item_name = 'Eggs Benedict'
    AND posted_at >= NOW() - INTERVAL '14 days'
) AS recently_posted;

-- ── IDEA SOURCE TRACKING ─────────────────────────────────────

-- Get all posts from Quick Suggestions
SELECT 
  id,
  status,
  suggestion_id,
  content_type,
  LEFT(post_text, 50) AS preview,
  scheduled_for,
  posted_at
FROM published_posts 
WHERE business_id = 'YOUR-BUSINESS-UUID'
  AND idea_source = 'quick_suggestions'
ORDER BY created_at DESC;

-- Get posts from Weekly Plan
SELECT 
  id,
  status,
  weekly_plan_id,
  weekly_plan_slot_date,
  content_type,
  scheduled_for,
  posted_at
FROM published_posts 
WHERE business_id = 'YOUR-BUSINESS-UUID'
  AND idea_source = 'weekly_plan'
ORDER BY weekly_plan_slot_date DESC;

-- ── STATISTICS & ANALYTICS ───────────────────────────────────

-- Post status breakdown for business
SELECT 
  status,
  COUNT(*) AS count,
  COUNT(*) FILTER (WHERE scheduled_for IS NOT NULL) AS with_schedule
FROM published_posts 
WHERE business_id = 'YOUR-BUSINESS-UUID'
GROUP BY status
ORDER BY 
  CASE status 
    WHEN 'draft' THEN 1 
    WHEN 'scheduled' THEN 2 
    WHEN 'published' THEN 3 
  END;

-- Idea source breakdown
SELECT 
  idea_source,
  status,
  COUNT(*) AS count
FROM published_posts 
WHERE business_id = 'YOUR-BUSINESS-UUID'
GROUP BY idea_source, status
ORDER BY idea_source, status;

-- Publishing rate (posts per week, last 4 weeks)
SELECT 
  DATE_TRUNC('week', posted_at)::date AS week_start,
  COUNT(*) AS posts_published,
  COUNT(DISTINCT content_type) AS content_variety
FROM published_posts 
WHERE business_id = 'YOUR-BUSINESS-UUID'
  AND status = 'published'
  AND posted_at >= NOW() - INTERVAL '4 weeks'
GROUP BY week_start
ORDER BY week_start DESC;

-- ── CLEANUP / MAINTENANCE ────────────────────────────────────

-- Delete old drafts (abandoned > 30 days ago)
DELETE FROM published_posts 
WHERE status = 'draft'
  AND updated_at < NOW() - INTERVAL '30 days'
RETURNING id, created_at, updated_at;

-- Archive published posts older than 1 year (optional)
-- Note: Consider moving to separate archive table instead
UPDATE published_posts 
SET source = 'archived'
WHERE status = 'published'
  AND posted_at < NOW() - INTERVAL '1 year';
