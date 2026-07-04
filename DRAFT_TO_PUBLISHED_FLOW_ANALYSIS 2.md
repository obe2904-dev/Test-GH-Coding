# Draft to Published Post Flow - Analysis & Recommendation

**Date**: 2026-06-03  
**Context**: User implementing scheduled/planned posts functionality

---

## Current Database State

### ✅ Tables That EXIST

1. **`published_posts`** - FUNCTIONAL
   - Purpose: Records of actually published content
   - Has: `business_id`, `platform`, `post_text`, `photo_url`, `source`, `content_type`, `menu_item_name`, `posted_at`, `published_at`
   - Migration: `20260528000001_published_posts_full_schema.sql`

2. **`daily_suggestions`** - FUNCTIONAL
   - Purpose: AI-generated Quick Suggestions (ideas shown on dashboard)
   - Has: `business_id`, `date`, `position`, `title`, `content_type`, `suggested_time`, `menu_item_name`, `is_active`
   - Migration: `20260514000000_add_daily_suggestions_schema.sql`

### ❌ Tables That DO NOT EXIST (Dropped)

1. **`post_drafts`** - DROPPED
   - Reason: "Never implemented, always empty" (cleanup June 2026)
   - Migration that dropped it: `20260602000001_cleanup_unused_tables.sql`
   - Migration that created it: `20260302000000_extend_post_drafts_idea_context.sql`

2. **`suggested_posts`** - LIKELY DROPPED
   - Backup file exists: `20260108125900_drop_suggested_posts.sql.bak`
   - Appears to be legacy/deprecated

---

## Current Workflow (As Implemented)

```
┌─────────────────────┐
│ Quick Suggestions   │ ← AI generates ideas
│ (daily_suggestions) │   Stored in DB
└──────────┬──────────┘
           │
           │ User clicks idea
           ↓
┌─────────────────────┐
│   ??? DRAFT ???     │ ← NOT STORED IN DB
│  (Frontend only?)   │   Works in-memory during session
└──────────┬──────────┘
           │
           │ User publishes
           ↓
┌─────────────────────┐
│  Post Published     │ ← Stored in published_posts
│ (published_posts)   │   Permanent record
└─────────────────────┘
```

**Problem**: There's no table to store **draft/planned posts** that:
- User is working on but hasn't published yet
- Are scheduled for future dates
- Can be recovered if user closes browser
- Can be listed as "planned for this week"

---

## Recommended Solution

### Option 1: Extend `published_posts` with status field (Simplest)

Add a `status` column to track lifecycle:

```sql
-- Migration: Add status tracking to published_posts
ALTER TABLE published_posts 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published'
    CHECK (status IN ('draft', 'scheduled', 'published'));

ALTER TABLE published_posts
  ADD COLUMN IF NOT EXISTS scheduled_for DATE;

-- Rename table to reflect dual purpose (optional)
-- ALTER TABLE published_posts RENAME TO posts;
```

**Workflow**:
```sql
-- 1. User creates draft from Quick Suggestion
INSERT INTO published_posts (
  business_id, status, content_type, post_text, 
  scheduled_for, source
) VALUES (
  'uuid...', 'draft', 'menu_item', 'Varm æggekage...', 
  '2026-06-06', 'quick_suggestions'
);

-- 2. User schedules it
UPDATE published_posts 
SET status = 'scheduled', scheduled_for = '2026-06-06'
WHERE id = 'draft-uuid';

-- 3. User publishes
UPDATE published_posts 
SET status = 'published', posted_at = NOW()
WHERE id = 'draft-uuid';
```

**Query Examples**:
```sql
-- Get all drafts for a business
SELECT * FROM published_posts 
WHERE business_id = 'uuid' AND status = 'draft';

-- Get scheduled posts for this week
SELECT * FROM published_posts 
WHERE business_id = 'uuid' 
  AND status = 'scheduled'
  AND scheduled_for BETWEEN '2026-06-03' AND '2026-06-09';

-- Get published posts (for recency filter)
SELECT * FROM published_posts 
WHERE business_id = 'uuid' AND status = 'published'
ORDER BY posted_at DESC;
```

**Pros**:
- ✅ Simple - one table for all post states
- ✅ Easy queries for timeline view
- ✅ Natural progression: draft → scheduled → published
- ✅ No need for data migration between tables

**Cons**:
- ⚠️ Mixes "published" and "not-yet-published" in same table
- ⚠️ Need to filter `WHERE status = 'published'` in recency queries

---

### Option 2: Recreate `post_drafts` as separate table

Restore the draft table with cleaner schema:

```sql
-- Migration: Recreate post_drafts for draft/scheduled posts
CREATE TABLE IF NOT EXISTS post_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Source tracking
  idea_source TEXT DEFAULT 'user' 
    CHECK (idea_source IN ('user', 'quick_suggestions', 'weekly_plan')),
  suggestion_id UUID, -- FK to daily_suggestions if from Quick Suggestions
  
  -- Status
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled')),
  
  -- Content
  content_type TEXT, -- menu_item, atmosphere, behind_scenes
  post_text TEXT,
  caption_data JSONB, -- Generated caption, hashtags, CTA
  
  -- Media
  photo_url TEXT,
  photo_idea TEXT,
  media_analysis JSONB,
  
  -- Scheduling
  scheduled_for DATE,
  scheduled_time TIME,
  
  -- Menu linkage
  menu_item_id UUID,
  menu_item_name TEXT,
  
  -- Platform targeting
  selected_platforms TEXT[] DEFAULT ARRAY['facebook', 'instagram'],
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_post_drafts_business ON post_drafts(business_id, status);
CREATE INDEX idx_post_drafts_scheduled ON post_drafts(scheduled_for) 
  WHERE status = 'scheduled';

-- RLS policies
ALTER TABLE post_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own drafts"
  ON post_drafts FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );
```

**Workflow**:
```sql
-- 1. User creates draft
INSERT INTO post_drafts (
  business_id, idea_source, suggestion_id, content_type,
  post_text, scheduled_for, status
) VALUES (
  'business-uuid', 'quick_suggestions', 'suggestion-uuid',
  'menu_item', 'Varm æggekage...', '2026-06-06', 'scheduled'
);

-- 2. User publishes
-- a) Insert into published_posts
INSERT INTO published_posts (
  business_id, platform, post_text, photo_url, source,
  content_type, menu_item_name, posted_at
)
SELECT 
  business_id, 'facebook', post_text, photo_url, idea_source,
  content_type, menu_item_name, NOW()
FROM post_drafts
WHERE id = 'draft-uuid';

-- b) Delete draft
DELETE FROM post_drafts WHERE id = 'draft-uuid';

-- OR keep draft as archive
UPDATE post_drafts SET status = 'published' WHERE id = 'draft-uuid';
```

**Pros**:
- ✅ Clean separation: drafts vs published
- ✅ `published_posts` queries don't need status filtering
- ✅ Can store richer draft metadata (phase, media_analysis, etc.)
- ✅ Matches the schema documented in POST_TYPE_SYSTEM.md

**Cons**:
- ⚠️ Need to move data between tables on publish
- ⚠️ More complex: maintain two tables

---

## Recommendation: **Option 1** (Extend `published_posts`)

**Why**:
1. **Simpler** - One table, one source of truth for all posts
2. **Natural lifecycle** - Status progression in same record
3. **Less migration complexity** - No data movement between tables
4. **Timeline queries easier** - Single table for "all my posts this week"
5. **Matches user's mental model** - "These are my posts, some published, some planned"

**Implementation**:
```sql
-- Migration: 20260603000001_add_post_status_tracking.sql

ALTER TABLE published_posts 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published'
    CHECK (status IN ('draft', 'scheduled', 'published'));

ALTER TABLE published_posts
  ADD COLUMN IF NOT EXISTS scheduled_for DATE;

ALTER TABLE published_posts
  ADD COLUMN IF NOT EXISTS idea_source TEXT DEFAULT 'manual'
    CHECK (idea_source IN ('manual', 'quick_suggestions', 'weekly_plan'));

ALTER TABLE published_posts
  ADD COLUMN IF NOT EXISTS suggestion_id UUID; -- FK to daily_suggestions

-- Index for draft/scheduled queries
CREATE INDEX IF NOT EXISTS idx_published_posts_status
  ON published_posts(business_id, status, scheduled_for);

-- Update existing rows to have status = 'published'
UPDATE published_posts SET status = 'published' WHERE status IS NULL;

COMMENT ON COLUMN published_posts.status IS 
  'Lifecycle status: draft (working), scheduled (planned), published (live)';
COMMENT ON COLUMN published_posts.scheduled_for IS 
  'Target date for scheduled posts (NULL for immediate/manual posts)';
COMMENT ON COLUMN published_posts.idea_source IS 
  'Origin: manual (user-created), quick_suggestions (AI Ideas), weekly_plan (strategy)';
```

**Updated Queries**:
```sql
-- Drafts for business
SELECT * FROM published_posts 
WHERE business_id = ? AND status = 'draft';

-- Scheduled this week
SELECT * FROM published_posts 
WHERE business_id = ? 
  AND status = 'scheduled'
  AND scheduled_for >= CURRENT_DATE
  AND scheduled_for < CURRENT_DATE + INTERVAL '7 days'
ORDER BY scheduled_for, id;

-- Published (for recency filter) - ADD status filter
SELECT * FROM published_posts 
WHERE business_id = ? 
  AND status = 'published'  -- ← Add this
  AND posted_at >= ?
ORDER BY posted_at DESC;

-- Full timeline (all states)
SELECT * FROM published_posts 
WHERE business_id = ?
ORDER BY 
  COALESCE(scheduled_for, posted_at::date) DESC,
  posted_at DESC;
```

---

## Action Items

**✅ COMPLETED:**
1. ✅ Created migration `20260603000001_add_post_status_tracking.sql` 
2. ✅ Created manual application SQL `APPLY_POST_STATUS_MIGRATION.sql`
3. ✅ Created verification queries `_verify_post_status_migration.sql`
4. ✅ Created query examples `_query_examples_post_status.sql`

**⚠️ REQUIRES MANUAL ACTION:**

### Apply the Migration

**Due to migration history mismatch, apply via Supabase Dashboard:**

1. Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new
2. Open file: `APPLY_POST_STATUS_MIGRATION.sql`
3. Copy entire contents and paste into SQL Editor
4. Click "Run"
5. Verify success message shows all 6 columns = 1

**After migration applied:**

1. Run verification: `_verify_post_status_migration.sql` (optional)
2. Update POST_TYPE_SYSTEM.md Section 12 to reflect single-table design ✅ (already updated)
3. Update recency filter queries to add `status = 'published'` condition
4. Update application code:
   - Draft creation: `INSERT ... status='draft'`
   - Schedule: `UPDATE ... status='scheduled', scheduled_for=?`
   - Publish: `UPDATE ... status='published', posted_at=NOW()`

---

## Files to Update

- `POST_TYPE_SYSTEM.md` - Section 12 (Post Storage & Lifecycle)
- Recency filter: `supabase/functions/_shared/post-helpers/opportunity-selector.ts` (likely location)
- Any queries using `published_posts` need `WHERE status = 'published'` added

---

**Questions for User**:
1. Should we rename `published_posts` → `posts` to reflect it now stores all states?
2. Keep drafts forever or auto-delete after publishing?
3. Should scheduled posts auto-publish (need cron job) or manual confirmation only?
