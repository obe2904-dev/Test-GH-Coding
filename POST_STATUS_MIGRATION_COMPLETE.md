# Post Status Migration - Implementation Complete ✅

**Date**: 2026-06-03  
**Migration**: `20260603000001_add_post_status_tracking.sql`  
**Status**: Successfully Applied

---

## What Was Implemented

Extended the `published_posts` table to support **draft and scheduled posts** in addition to published posts, creating a unified post lifecycle system.

### New Columns Added

| Column | Type | Purpose | Default |
|--------|------|---------|---------|
| `status` | TEXT | Lifecycle state: `'draft'`, `'scheduled'`, or `'published'` | `'published'` |
| `scheduled_for` | DATE | Target posting date for scheduled posts | `NULL` |
| `idea_source` | TEXT | Origin: `'manual'`, `'quick_suggestions'`, or `'weekly_plan'` | `'manual'` |
| `suggestion_id` | UUID | Links to `daily_suggestions.id` if from Quick Suggestions | `NULL` |
| `caption_data` | JSONB | Generated caption with hashtags, CTA, platform variants | `NULL` |
| `media_metadata` | JSONB | Photo analysis and media suggestions | `NULL` |

### Indexes Created

1. **`idx_published_posts_status`** - Fast draft/scheduled lookups by business
2. **`idx_published_posts_scheduled`** - Efficient scheduled post queries
3. **`idx_published_posts_idea_source`** - Track posts by origin (Quick Suggestions, Weekly Plan)

---

## Post Lifecycle Flow

```
┌─────────────┐
│   DRAFT     │  User creates post, uploads photo, generates caption
│ status='draft'│  Not visible publicly
└──────┬──────┘
       │
       │ User schedules for future date
       ↓
┌─────────────┐
│  SCHEDULED  │  Post planned for specific date
│status='scheduled'│  scheduled_for = '2026-06-06'
│scheduled_for│  Ready to publish on that date
└──────┬──────┘
       │
       │ User publishes (manual or auto)
       ↓
┌─────────────┐
│  PUBLISHED  │  Live post, visible publicly
│status='published'│  posted_at = NOW()
│  posted_at  │  Counts toward recency filter
└─────────────┘
```

---

## Usage Examples

### 1. Create a Draft from Quick Suggestion

```sql
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
  'Varm æggekage med sprødt bacon og friske urter',
  '{"text": "Perfekt brunch-start 🍳", "hashtags": ["#brunch", "#Copenhagen"]}'::jsonb,
  '{"photo_idea": "Close-up of warm egg dish with fresh herbs"}'::jsonb,
  '2026-06-06',
  'quick_suggestions'
)
RETURNING id, status, scheduled_for;
```

### 2. Schedule a Draft for Future Posting

```sql
UPDATE published_posts 
SET 
  status = 'scheduled',
  scheduled_for = '2026-06-06',
  updated_at = NOW()
WHERE id = 'draft-uuid'
  AND status = 'draft'
RETURNING id, status, scheduled_for;
```

### 3. Publish a Scheduled Post

```sql
UPDATE published_posts 
SET 
  status = 'published',
  platform = 'facebook',
  posted_at = NOW(),
  published_at = NOW(),
  updated_at = NOW()
WHERE id = 'scheduled-post-uuid'
  AND status = 'scheduled'
RETURNING id, status, posted_at;
```

### 4. View All Drafts for a Business

```sql
SELECT 
  id,
  idea_source,
  content_type,
  LEFT(post_text, 60) AS preview,
  scheduled_for,
  created_at
FROM published_posts 
WHERE business_id = 'your-business-uuid' 
  AND status = 'draft'
ORDER BY created_at DESC;
```

### 5. View Scheduled Posts for This Week

```sql
SELECT 
  id,
  scheduled_for,
  content_type,
  LEFT(post_text, 60) AS preview,
  idea_source
FROM published_posts 
WHERE business_id = 'your-business-uuid' 
  AND status = 'scheduled'
  AND scheduled_for >= CURRENT_DATE
  AND scheduled_for < CURRENT_DATE + INTERVAL '7 days'
ORDER BY scheduled_for;
```

### 6. Full Timeline View (All Post States)

```sql
SELECT 
  id,
  status,
  COALESCE(scheduled_for, posted_at::date) AS target_date,
  content_type,
  LEFT(post_text, 50) AS preview,
  idea_source,
  created_at
FROM published_posts 
WHERE business_id = 'your-business-uuid'
ORDER BY 
  COALESCE(scheduled_for, posted_at::date) DESC,
  created_at DESC;
```

### 7. Posts Ready to Publish Today (Cron Job)

```sql
SELECT 
  id,
  business_id,
  scheduled_for,
  post_text,
  platform,
  caption_data,
  media_metadata
FROM published_posts 
WHERE status = 'scheduled'
  AND scheduled_for <= CURRENT_DATE
ORDER BY scheduled_for, created_at;
```

---

## ⚠️ Important: Update Recency Filter Queries

**All queries that check recently published posts MUST now filter by status:**

### Before (Old - Incorrect)
```sql
SELECT * FROM published_posts 
WHERE business_id = ?
  AND posted_at >= NOW() - INTERVAL '14 days';
```

### After (New - Correct)
```sql
SELECT * FROM published_posts 
WHERE business_id = ?
  AND status = 'published'  -- ← ADD THIS
  AND posted_at >= NOW() - INTERVAL '14 days';
```

**Why**: Without `status = 'published'`, the query will include drafts and scheduled posts, causing incorrect recency filtering.

**Files to update**:
- Any recency filter in `opportunity-selector.ts` or similar
- Any query counting "recent posts"
- Weekly Plan strategy generation (avoid recently published content)

---

## Integration with Weekly Plan

When implementing Weekly Plan, use the new schema:

### Creating Drafts from Weekly Plan

```sql
INSERT INTO published_posts (
  business_id,
  user_id,
  status,
  idea_source,
  weekly_plan_id,
  weekly_plan_slot_date,
  content_type,
  post_text,
  scheduled_for,
  source
) VALUES (
  'business-uuid',
  'user-uuid',
  'scheduled',  -- Pre-schedule it
  'weekly_plan',
  'strategy-uuid',
  '2026-06-06',
  'atmosphere',
  'Generated post text...',
  '2026-06-06',  -- Scheduled for same date
  'weekly_plan'
);
```

### Querying Weekly Plan Posts

```sql
-- All posts from this week's plan
SELECT * FROM published_posts
WHERE business_id = 'your-business-uuid'
  AND idea_source = 'weekly_plan'
  AND weekly_plan_slot_date >= '2026-06-03'
  AND weekly_plan_slot_date < '2026-06-10';

-- How many plan posts were actually published?
SELECT COUNT(*) FROM published_posts
WHERE idea_source = 'weekly_plan'
  AND status = 'published'
  AND weekly_plan_id = 'strategy-uuid';
```

---

## Statistics & Analytics Queries

### Post Status Breakdown

```sql
SELECT 
  status,
  COUNT(*) AS count,
  COUNT(*) FILTER (WHERE scheduled_for IS NOT NULL) AS with_schedule,
  COUNT(*) FILTER (WHERE idea_source = 'quick_suggestions') AS from_ai_ideas,
  COUNT(*) FILTER (WHERE idea_source = 'weekly_plan') AS from_weekly_plan
FROM published_posts 
WHERE business_id = 'your-business-uuid'
GROUP BY status;
```

### Weekly Publishing Rate

```sql
SELECT 
  DATE_TRUNC('week', posted_at)::date AS week_start,
  COUNT(*) AS posts_published,
  COUNT(DISTINCT content_type) AS content_variety,
  COUNT(*) FILTER (WHERE idea_source = 'quick_suggestions') AS from_suggestions,
  COUNT(*) FILTER (WHERE idea_source = 'weekly_plan') AS from_plan
FROM published_posts 
WHERE business_id = 'your-business-uuid'
  AND status = 'published'
  AND posted_at >= NOW() - INTERVAL '4 weeks'
GROUP BY week_start
ORDER BY week_start DESC;
```

---

## Maintenance Tasks

### Clean Up Old Drafts (30+ Days)

```sql
-- Preview first
SELECT id, created_at, updated_at, LEFT(post_text, 40)
FROM published_posts 
WHERE status = 'draft'
  AND updated_at < NOW() - INTERVAL '30 days';

-- Delete if safe
DELETE FROM published_posts 
WHERE status = 'draft'
  AND updated_at < NOW() - INTERVAL '30 days'
RETURNING id, created_at;
```

### Archive Old Published Posts (Optional)

```sql
-- Posts older than 1 year could be archived
-- Consider moving to separate archive table instead of deleting
SELECT COUNT(*) FROM published_posts
WHERE status = 'published'
  AND posted_at < NOW() - INTERVAL '1 year';
```

---

## Testing the Migration

Run verification queries from `_verify_post_status_migration.sql`:

```sql
-- 1. Check all columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'published_posts'
  AND column_name IN ('status', 'scheduled_for', 'idea_source', 
                      'suggestion_id', 'caption_data', 'media_metadata')
ORDER BY column_name;

-- 2. Check all existing posts have status = 'published'
SELECT 
  COUNT(*) AS total_posts,
  COUNT(*) FILTER (WHERE status = 'published') AS published_status,
  COUNT(*) FILTER (WHERE status IS NULL) AS null_status
FROM published_posts;

-- 3. Verify indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'published_posts'
  AND (indexname LIKE '%status%' 
    OR indexname LIKE '%idea%' 
    OR indexname LIKE '%scheduled%');
```

---

## Next Steps

1. ✅ **Migration Applied** - Database schema updated
2. ⚠️ **Update Recency Filters** - Add `status = 'published'` to queries
3. 📝 **Update Frontend** - Build UI for draft/scheduled posts
4. 🔄 **Weekly Plan Integration** - Use new schema for strategy posts
5. ⏰ **Optional: Auto-Publishing** - Create cron job to publish scheduled posts

---

## Files Reference

- **Migration SQL**: `supabase/migrations/20260603000001_add_post_status_tracking.sql`
- **Manual Application**: `APPLY_POST_STATUS_MIGRATION.sql` ✅ Applied
- **Query Examples**: `_query_examples_post_status.sql`
- **Verification**: `_verify_post_status_migration.sql`
- **Architecture Analysis**: `DRAFT_TO_PUBLISHED_FLOW_ANALYSIS.md`
- **System Documentation**: `POST_TYPE_SYSTEM.md` (Section 12 updated)

---

## Migration Verification Result

```json
{
  "message": "Migration completed successfully!",
  "status_col": 1,
  "scheduled_for_col": 1,
  "idea_source_col": 1,
  "suggestion_id_col": 1,
  "caption_data_col": 1,
  "media_metadata_col": 1
}
```

✅ All columns successfully added!

---

**END OF DOCUMENT**
