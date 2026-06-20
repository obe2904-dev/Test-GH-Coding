-- ============================================================
-- USAGE EXAMPLES: suggested_post_time Column
-- ============================================================
-- 
-- Examples of how to use the new suggested_post_time column
-- to preserve AI-recommended posting times through the
-- workflow: AI Ideas → Design → Udgiv (Publish)
--
-- ============================================================

-- ── Example 1: Create Draft from Quick Suggestion ───────────
-- When user clicks "Design" on a Quick Suggestion,
-- store BOTH the date AND the suggested time

INSERT INTO published_posts (
  business_id,
  user_id,
  status,
  idea_source,
  suggestion_id,
  content_type,
  post_text,
  scheduled_for,
  suggested_post_time,  -- ← Store the AI-recommended time
  caption_data,
  media_metadata,
  source
) VALUES (
  'f4679fa9-3120-4a59-9506-d059b010c34a',
  'user-uuid',
  'draft',
  'quick_suggestions',
  'suggestion-uuid',
  'menu_item',
  'Varm æggekage med sprødt bacon og friske urter 🍳',
  '2026-06-04',          -- Date
  '17:00',               -- ← AI suggested this time (from Quick Suggestions)
  '{"text": "Perfekt til brunch!", "hashtags": ["#brunch"]}'::jsonb,
  '{"photo_idea": "Close-up of warm egg dish"}'::jsonb,
  'quick_suggestions'
)
RETURNING id, status, scheduled_for, suggested_post_time;


-- ── Example 2: Display Suggested Time in "Udgiv" UI ─────────
-- When user opens the "Udgiv" (Publish) screen,
-- show them the AI-recommended time

SELECT 
  id,
  post_text,
  scheduled_for,
  suggested_post_time,  -- ← Show this in the UI as "Forslag: kl. 17:00"
  content_type,
  caption_data,
  media_metadata
FROM published_posts 
WHERE id = 'draft-uuid'
  AND status = 'draft';

-- Frontend can display:
-- "AI anbefaler at udgive i dag kl. 17:00"


-- ── Example 3: Schedule Post with Different Time ─────────────
-- User can choose to use the suggested time OR pick their own

-- Option A: User accepts the AI suggestion
UPDATE published_posts 
SET 
  status = 'scheduled',
  scheduled_for = '2026-06-04',
  -- Keep suggested_post_time = '17:00' (already stored)
  updated_at = NOW()
WHERE id = 'draft-uuid';

-- Option B: User picks a different time (e.g., 12:00)
UPDATE published_posts 
SET 
  status = 'scheduled',
  scheduled_for = '2026-06-04',
  suggested_post_time = '12:00',  -- ← User overrides the AI suggestion
  updated_at = NOW()
WHERE id = 'draft-uuid';


-- ── Example 4: Publish Immediately (Ignore Suggestion) ───────
-- User clicks "Udgiv nu" (Publish now) regardless of suggested time

UPDATE published_posts 
SET 
  status = 'published',
  platform = 'facebook',
  posted_at = NOW(),
  published_at = NOW(),
  -- suggested_post_time stays as historical record
  updated_at = NOW()
WHERE id = 'draft-uuid';


-- ── Example 5: Analytics - When Do Users Follow AI Advice? ──
-- See if users are publishing at the suggested times

SELECT 
  CASE 
    WHEN EXTRACT(HOUR FROM posted_at AT TIME ZONE 'Europe/Copenhagen') = 
         EXTRACT(HOUR FROM suggested_post_time)
    THEN 'Followed AI suggestion'
    ELSE 'Chose different time'
  END AS user_choice,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS percentage
FROM published_posts 
WHERE status = 'published'
  AND idea_source = 'quick_suggestions'
  AND suggested_post_time IS NOT NULL
  AND posted_at >= NOW() - INTERVAL '30 days'
GROUP BY 1;


-- ── Example 6: Find Drafts Ready to Publish at Suggested Time ──
-- Cron job: Auto-publish posts when it's their suggested time

SELECT 
  id,
  business_id,
  post_text,
  suggested_post_time
FROM published_posts 
WHERE status = 'scheduled'
  AND scheduled_for = CURRENT_DATE
  AND suggested_post_time = LOCALTIME::TIME  -- Current hour
ORDER BY suggested_post_time;


-- ── Example 7: UI Helper - Format Suggested Time for Display ──
-- Get drafts with nicely formatted suggested times

SELECT 
  id,
  LEFT(post_text, 50) AS preview,
  scheduled_for,
  TO_CHAR(suggested_post_time, 'HH24:MI') AS suggested_time_formatted,
  CASE 
    WHEN suggested_post_time BETWEEN '06:00' AND '11:00' THEN 'Morgen'
    WHEN suggested_post_time BETWEEN '11:00' AND '15:00' THEN 'Frokost'
    WHEN suggested_post_time BETWEEN '15:00' AND '18:00' THEN 'Eftermiddag'
    WHEN suggested_post_time BETWEEN '18:00' AND '22:00' THEN 'Aften'
    ELSE 'Nat'
  END AS time_period
FROM published_posts 
WHERE business_id = 'your-business-uuid'
  AND status = 'draft'
  AND suggested_post_time IS NOT NULL
ORDER BY suggested_post_time;


-- ── Example 8: Bulk Update - Preserve Times from Suggestions ──
-- If you need to backfill suggested_post_time from suggestion metadata

UPDATE published_posts p
SET suggested_post_time = (s.metadata->>'suggestedTime')::TIME
FROM daily_suggestions s
WHERE p.suggestion_id = s.id
  AND p.suggested_post_time IS NULL
  AND s.metadata->>'suggestedTime' IS NOT NULL;


-- ============================================================
-- FRONTEND INTEGRATION NOTES
-- ============================================================
--
-- 1. AI Ideas Screen:
--    - When generating suggestions, include targetPostTime
--    - Display as: "Forslag til kl. 17:00"
--
-- 2. Design Screen:
--    - When creating draft, capture suggested_post_time
--    - Show in UI: "AI anbefaler kl. 17:00"
--
-- 3. Udgiv Screen:
--    - Pre-fill time picker with suggested_post_time
--    - Show as default: "Foreslået tidspunkt: kl. 17:00"
--    - Allow user to change if desired
--    - Visual indicator if user picks different time
--
-- 4. Calendar/Timeline View:
--    - Show scheduled posts with their suggested times
--    - Color-code: green = at suggested time, yellow = different time
--
-- ============================================================
