# Posts Table Consolidation Plan

**Date:** 2026-06-20  
**Status:** Proposal  
**Decision:** Consolidate `post_drafts` and `published_posts` into a single `posts` table

---

## Executive Summary

Currently, posts flow through two separate database tables:
1. **`post_drafts`** - Stores work-in-progress posts (Idea → Design → Udgiv stages)
2. **`published_posts`** - Stores committed posts (published now or scheduled for future)

**Recommendation: Consolidate into a single `posts` table with a status column.**

This eliminates unnecessary data migration between tables and simplifies the entire post lifecycle.

---

## Current Architecture Analysis

### Table: `post_drafts`
**Purpose:** Work-in-progress posts before they are published/scheduled

**Key Columns:**
- `id` (UUID)
- `business_id` (UUID)
- `user_id` (UUID)
- `platforms` (TEXT[]) - Selected platforms for the post
- `platform` (TEXT) - Single platform after split (Udgiv stage)
- `post_text` (TEXT)
- `photo_url` (TEXT)
- `content_json` (JSONB) - Full PostContent snapshot
- `idea_source` (TEXT) - 'write', 'quick_suggestions', 'weekly_plan'
- `suggestion_id` (INTEGER) - Links to daily_suggestions
- `weekly_plan_id` (UUID)
- `weekly_plan_slot_index` (INTEGER)
- `weekly_plan_slot_date` (DATE)
- `suggested_post_datetime` (TIMESTAMPTZ)
- `created_at`, `updated_at`

**Issues:**
- Limited schema - missing many fields that published_posts has
- Gets deleted when post is published (data loss)
- Requires migration logic to move data to published_posts

### Table: `published_posts`
**Purpose:** Posts that have been published or scheduled

**Key Columns:**
- `id` (UUID)
- `business_id` (UUID)
- `user_id` (UUID)
- `platform` (TEXT) - Single platform
- `post_text` (TEXT)
- `photo_url` (TEXT)
- `media_metadata` (JSONB)
- `source` (TEXT) - 'manual_copy_paste', 'auto'
- `content_type` (TEXT) - 'product', 'experience', etc.
- `menu_item_id` (UUID)
- `menu_item_name` (TEXT)
- `weekly_plan_id` (UUID)
- `weekly_plan_idea_id` (INTEGER)
- `weekly_plan_slot_date` (DATE)
- `idea_source` (TEXT)
- `suggestion_id` (INTEGER)
- `status` (TEXT) - 'draft', 'scheduled', 'published'
- `scheduled_for` (TIMESTAMPTZ)
- `posted_at` (TIMESTAMPTZ)
- `published_at` (TIMESTAMPTZ)
- `suggested_post_time` (TEXT)
- `caption_data` (JSONB)
- `created_at`

**Issues:**
- Already has a `status` column (supports 'draft', 'scheduled', 'published')
- More complete schema than post_drafts
- BUT: drafts are stored in a separate table

---

## Current Flow

### 1. Idea Stage
- User creates idea (manual write, AI suggestion, or weekly plan)
- Stored in appropriate source table (not in post_drafts yet)

### 2. Design Stage  
- User refines text, adds hashtags, uploads photos
- **One row** in `post_drafts` (if auto-saving is enabled)
- Key: `business_id + idea_source + suggestion_id/weekly_plan_slot_date`

### 3. Udgiv Stage (SPLIT HAPPENS HERE)
- User proceeds to Udgiv (Publish stage)
- **Posts are split into separate rows per platform**
- Example: 1 draft for both platforms → 2 rows in `post_drafts`
  - Row 1: `platform='facebook'`
  - Row 2: `platform='instagram'`

### 4. Publish/Schedule
- User clicks "Udgiv nu" or "Planlæg"
- **Data is moved** from `post_drafts` → `published_posts`
- Original `post_drafts` row is **deleted**
- New row created in `published_posts` with `status='published'` or `status='scheduled'`

### 5. Published
- Post exists only in `published_posts`
- Can be rescheduled, edited, or deleted
- No connection back to original draft

---

## Problems with Current Architecture

### 1. **Data Migration Complexity**
```typescript
// Current flow requires moving data between tables
const { data, error } = await savePublishedPost({
  businessId: business.id,
  platform: platform.toLowerCase(),
  postText,
  photoFile,
  // ... 20+ fields to map
})

// Then delete the draft
await postDrafts.deleteByKey(dbKey)
```

### 2. **Data Loss**
- Once published, the original draft is deleted
- Lose the edit history and intermediate states
- Cannot easily restore to draft state

### 3. **Inconsistent Schemas**
- `post_drafts` has ~15 columns
- `published_posts` has ~30 columns
- Different field names for same data
- Duplication of logic

### 4. **Split-Row Complexity**
- Posts split into per-platform rows at Udgiv stage
- Each platform gets its own row
- Hard to query "all platforms for this idea"
- Complex sibling-post logic

### 5. **Timeline Confusion**
```typescript
// Current timeline needs to query BOTH tables
const drafts = await postDrafts.loadAllDrafts(business.id)
const { data: publishedPosts } = await supabase
  .from('published_posts')
  .select('*')
  .in('status', ['scheduled', 'published'])
```

---

## Proposed Solution: Single `posts` Table

### Schema Design

```sql
CREATE TABLE posts (
  -- Identity
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Status & Lifecycle
  status                TEXT NOT NULL DEFAULT 'draft' 
                          CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  
  -- Platform(s)
  -- During Design stage: NULL (unified draft)
  -- During Udgiv stage: specific platform ('facebook', 'instagram')
  platform              TEXT CHECK (platform IN ('facebook', 'instagram')),
  
  -- Content
  post_text             TEXT,
  photo_url             TEXT,
  content_json          JSONB,  -- Full PostContent snapshot
  caption_data          JSONB,  -- Structured caption data
  media_metadata        JSONB,  -- Rich media metadata
  
  -- Source & Context
  idea_source           TEXT NOT NULL 
                          CHECK (idea_source IN ('write', 'quick_suggestions', 'weekly_plan')),
  suggestion_id         INTEGER REFERENCES daily_suggestions(id) ON DELETE SET NULL,
  weekly_plan_id        UUID REFERENCES weekly_content_plans(id) ON DELETE SET NULL,
  weekly_plan_idea_id   INTEGER,
  weekly_plan_slot_date DATE,
  weekly_plan_slot_index INTEGER,
  
  -- Content Classification
  content_type          TEXT CHECK (content_type IN ('product', 'experience', 'occasion', 
                                                       'atmosphere', 'retention', 'team')),
  menu_item_id          UUID,
  menu_item_name        TEXT,
  
  -- Timing
  suggested_post_datetime TIMESTAMPTZ,  -- AI recommendation
  suggested_post_time     TEXT,         -- Time string from suggestion (e.g., "17:00")
  scheduled_for           TIMESTAMPTZ,  -- User-selected schedule time
  posted_at               TIMESTAMPTZ,  -- Actual publish time (for 'published' status)
  published_at            TIMESTAMPTZ,  -- Alias for backwards compatibility
  
  -- Metadata
  source                TEXT DEFAULT 'manual_copy_paste',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_posts_business_status ON posts(business_id, status);
CREATE INDEX idx_posts_business_scheduled ON posts(business_id, scheduled_for) 
  WHERE status = 'scheduled';
CREATE INDEX idx_posts_business_published ON posts(business_id, published_at DESC) 
  WHERE status = 'published';
CREATE INDEX idx_posts_weekly_plan ON posts(weekly_plan_slot_date) 
  WHERE weekly_plan_slot_date IS NOT NULL;
CREATE INDEX idx_posts_suggestion ON posts(suggestion_id) 
  WHERE suggestion_id IS NOT NULL;

-- Composite index for rotation/recency filters
CREATE INDEX idx_posts_menu_rotation 
  ON posts(business_id, menu_item_name, posted_at DESC)
  WHERE status = 'published' AND menu_item_name IS NOT NULL;
```

---

## New Flow with Single Table

### 1. Idea Stage
- No database row yet (or could create with `status='idea'` if desired)

### 2. Design Stage
- **INSERT** new row with `status='draft'`, `platform=NULL`
- Auto-save updates this row
- Key: `business_id + idea_source + suggestion_id/weekly_plan_slot_date + platform=NULL`

### 3. Udgiv Stage (SPLIT)
- User proceeds to Udgiv
- **Per-platform rows are created** with `status='draft'`
  - Row 1: `platform='facebook'`, `status='draft'`
  - Row 2: `platform='instagram'`, `status='draft'`
- Original unified draft (`platform=NULL`) can be kept or deleted

### 4. Publish/Schedule
- **UPDATE** the row: `SET status='scheduled'` or `status='published'`
- Set `scheduled_for` or `posted_at` timestamps
- No data migration needed!

### 5. Reschedule
- **UPDATE** existing row: change `scheduled_for`

### 6. Archive
- **UPDATE** existing row: `SET status='archived'`
- Keep the data for analytics/history

---

## Code Changes Required

### 1. Migration File
**File:** `supabase/migrations/YYYYMMDD_consolidate_posts_tables.sql`

```sql
-- Drop old tables (NO DATA MIGRATION NEEDED - no live users)
DROP TABLE IF EXISTS post_drafts CASCADE;
-- Keep published_posts and rename it
ALTER TABLE published_posts RENAME TO posts;

-- Add missing columns from post_drafts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_json JSONB;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS weekly_plan_slot_index INTEGER;

-- Update status column constraint to include 'archived'
ALTER TABLE posts DROP CONSTRAINT IF EXISTS published_posts_status_check;
ALTER TABLE posts ADD CONSTRAINT posts_status_check 
  CHECK (status IN ('draft', 'scheduled', 'published', 'archived'));

-- Update indexes
DROP INDEX IF EXISTS idx_published_posts_business_at;
DROP INDEX IF EXISTS idx_published_posts_weekly_plan;
-- ... (create new indexes as shown above)
```

### 2. Hooks Consolidation

**Delete:** `src/hooks/usePostDrafts.ts`  
**Delete:** `src/hooks/usePublishedPosts.ts`  
**Create:** `src/hooks/usePosts.ts`

```typescript
export function usePosts() {
  const saveDraft = async (data: PostData) => {
    // INSERT or UPDATE with status='draft'
    const { data: result, error } = await supabase
      .from('posts')
      .upsert({
        ...data,
        status: 'draft',
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    return result
  }

  const publishPost = async (id: string, scheduledFor?: Date) => {
    // UPDATE existing draft to published/scheduled
    const status = scheduledFor ? 'scheduled' : 'published'
    const updates: any = { 
      status,
      updated_at: new Date().toISOString()
    }
    
    if (scheduledFor) {
      updates.scheduled_for = scheduledFor.toISOString()
    } else {
      updates.posted_at = new Date().toISOString()
      updates.published_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', id)
    
    return { error }
  }

  const loadDrafts = async (businessId: string) => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
    
    return { data, error }
  }

  const loadScheduledPosts = async (businessId: string) => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'scheduled')
      .order('scheduled_for', { ascending: true })
    
    return { data, error }
  }

  const loadPublishedPosts = async (businessId: string, limit = 50) => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'published')
      .order('posted_at', { ascending: false })
      .limit(limit)
    
    return { data, error }
  }

  const archivePost = async (id: string) => {
    const { error } = await supabase
      .from('posts')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id)
    
    return { error }
  }

  const deletePost = async (id: string) => {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id)
    
    return { error }
  }

  return {
    saveDraft,
    publishPost,
    loadDrafts,
    loadScheduledPosts,
    loadPublishedPosts,
    archivePost,
    deletePost
  }
}
```

### 3. PublishStep Component Updates

**File:** `src/components/post-creation/PublishStep.tsx`

**Before:**
```typescript
// Save to published_posts, delete from post_drafts
const { id, error } = await savePublishedPost({ /* ... */ })
await postDrafts.deleteByKey(dbKey)
```

**After:**
```typescript
// Just update status on existing draft row
const { error } = await posts.publishPost(draftId, scheduledFor)
```

### 4. Timeline Loading

**Before:**
```typescript
// Load from TWO tables
const drafts = await postDrafts.loadAllDrafts(business.id)
const { data: publishedPosts } = await supabase
  .from('published_posts')
  .select('*')
  .eq('business_id', business.id)
  .in('status', ['scheduled', 'published'])
```

**After:**
```typescript
// Load from ONE table, filter by status
const { data: allPosts } = await supabase
  .from('posts')
  .select('*')
  .eq('business_id', business.id)
  .in('status', ['draft', 'scheduled', 'published'])
  .order('created_at', { ascending: false })
```

---

## Benefits

### ✅ **Simpler Architecture**
- One table, one source of truth
- No data migration logic
- Easier to reason about

### ✅ **Complete History**
- Posts stay in the same row through their entire lifecycle
- Full edit history preserved
- Easy to track status changes

### ✅ **Better Queries**
```sql
-- All posts for a weekly plan slot
SELECT * FROM posts WHERE weekly_plan_slot_date = '2026-06-22'

-- Published posts in last 14 days
SELECT * FROM posts 
WHERE business_id = ? 
  AND status = 'published' 
  AND posted_at >= now() - interval '14 days'

-- Drafts for a specific suggestion
SELECT * FROM posts 
WHERE suggestion_id = ? 
  AND status = 'draft'
```

### ✅ **Flexible Status Transitions**
```
draft → scheduled → published
draft → published (post now)
scheduled → draft (cancel schedule, back to editing)
published → archived (cleanup old posts)
```

### ✅ **Atomic Updates**
- No risk of partial migration (row in published_posts but draft delete fails)
- All fields updated in a single transaction

### ✅ **Better for Analytics**
- One table to query for all post metrics
- Easy to build dashboards showing draft → published conversion
- Track how long posts stay in each status

---

## Risks & Mitigations

### Risk: Breaking Changes
**Mitigation:** Since you have no live users, we can do a clean-slate migration

### Risk: Complex Queries
**Mitigation:** Use proper indexes; status-based filtering is fast with indexes

### Risk: Platform Split Logic
**Mitigation:** Keep same logic, just update status instead of migrating tables

---

## Implementation Steps

### Phase 1: Database Schema
1. ✅ Create new migration file
2. ✅ Rename `published_posts` → `posts`
3. ✅ Add missing columns from `post_drafts`
4. ✅ Update constraints and indexes
5. ✅ Drop `post_drafts` table
6. ✅ Run migration in Supabase

### Phase 2: Backend Hooks
1. ✅ Create new `usePosts.ts` hook
2. ✅ Update `PublishStep.tsx` to use new hook
3. ✅ Update all components that reference drafts/published posts
4. ✅ Remove old hooks

### Phase 3: Testing
1. ✅ Test full flow: write → design → udgiv → publish
2. ✅ Test scheduling
3. ✅ Test timeline display
4. ✅ Test weekly plan flow

### Phase 4: Cleanup
1. ✅ Delete `usePostDrafts.ts`
2. ✅ Delete `usePublishedPosts.ts`
3. ✅ Update TypeScript types
4. ✅ Remove migration logic from PublishStep

---

## Timeline Estimate

- **Phase 1 (Database):** 1 hour
- **Phase 2 (Backend):** 2-3 hours  
- **Phase 3 (Testing):** 1-2 hours
- **Phase 4 (Cleanup):** 30 minutes

**Total:** ~5-7 hours

---

## Recommendation

**✅ PROCEED with consolidation**

The benefits far outweigh the complexity. With no live users, this is the perfect time to simplify your architecture. The current two-table approach was reasonable as an initial design, but now that you understand the full post lifecycle, a single-table design is clearly superior.

The main work is updating the TypeScript code to use the new unified `posts` table, but the logic remains largely the same—you're just changing WHERE you save/update data, not HOW posts flow through the system.

---

## Next Steps

**Want me to implement this?** I can:

1. Create the migration SQL file
2. Build the new `usePosts` hook
3. Update `PublishStep.tsx` and other components
4. Test the full flow

Let me know if you'd like me to proceed! 🚀
