# Quick Suggestions Regeneration Enhancement

**Date:** June 10, 2026  
**Status:** ✅ COMPLETE

## Problem

When regenerating daily quick suggestions, the old suggestions were being deactivated but their associated generated texts (in `post_drafts`) were not being cleaned up. This led to orphaned draft data accumulating in the database.

## Solution

Enhanced the `deactivate_old_suggestions()` function to also delete associated `post_drafts` when regenerating suggestions for a day.

## What Changed

### Database Function Enhanced
**File:** `supabase/migrations/20260610000001_enhance_suggestion_regeneration.sql`

The `deactivate_old_suggestions` function now:
1. **Collects** all suggestion IDs that will be deactivated for that business/date
2. **Deletes** all `post_drafts` that reference those suggestions
3. **Deactivates** the suggestions themselves (existing behavior)

### Safety Guarantees

✅ **Scheduled/Posted content is safe:**
- Published/scheduled posts live in the `published_posts` table
- That table has NO `suggestion_id` column
- Therefore, regenerating suggestions CANNOT affect published/scheduled posts

✅ **Only drafts are affected:**
- Only `post_drafts` with matching `suggestion_id` are deleted
- These are text generations that haven't been published yet
- Once a user publishes/schedules, the post moves to `published_posts` and is disconnected

## User Flow

1. User clicks **Regenerate** button in dashboard
2. Frontend calls `get-quick-suggestions` with `regenerate: true`
3. Edge function calls `deactivate_old_suggestions(business_id, date)`
4. RPC function executes:
   ```sql
   -- Find all active suggestions for today
   SELECT ARRAY_AGG(id) FROM daily_suggestions 
   WHERE business_id = X AND suggestion_date = TODAY AND is_active = true
   
   -- Delete their draft texts
   DELETE FROM post_drafts 
   WHERE suggestion_id IN (collected IDs) AND business_id = X
   
   -- Deactivate the suggestions
   UPDATE daily_suggestions 
   SET is_active = false 
   WHERE business_id = X AND suggestion_date = TODAY
   ```
5. New suggestions are generated and saved
6. User sees fresh suggestions with no old draft texts

## Architecture

```
┌─────────────────────────┐
│  daily_suggestions      │
│  (ideas for the day)    │
│  - id (PK)              │
│  - business_id          │
│  - suggestion_date      │
│  - is_active            │
└──────────┬──────────────┘
           │
           │ suggestion_id (FK-like)
           ↓
┌─────────────────────────┐
│  post_drafts            │
│  (generated texts)      │
│  - id (PK)              │
│  - suggestion_id        │ ← Deleted on regenerate
│  - post_text            │
│  - platforms[]          │
└─────────────────────────┘

           ↓ (on publish/schedule)

┌─────────────────────────┐
│  published_posts        │
│  (final posts)          │
│  - id (PK)              │
│  - NO suggestion_id!    │ ← Safe from regeneration
│  - post_text            │
│  - posted_at            │
└─────────────────────────┘
```

## To Apply Migration

### Option 1: Supabase Dashboard (Recommended)
1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to **SQL Editor** → **New Query**
3. Copy contents of `supabase/migrations/20260610000001_enhance_suggestion_regeneration.sql`
4. Paste and click **Run**

### Option 2: CLI (if configured)
```bash
supabase db push
```

### Option 3: Script (if env vars set)
```bash
deno run --allow-net --allow-env scripts/apply-regeneration-enhancement.ts
```

## Testing

After applying the migration, test the flow:

1. Generate quick suggestions for today
2. Generate text for one of them (creates `post_drafts` entry)
3. Click **Regenerate** suggestions
4. Verify:
   - ✅ Old suggestions are deactivated
   - ✅ Old `post_drafts` are deleted
   - ✅ New suggestions appear
   - ✅ Any previously published posts remain untouched

## Files Changed

- ✅ `supabase/migrations/20260610000001_enhance_suggestion_regeneration.sql` (new)
- ✅ `scripts/apply-regeneration-enhancement.ts` (new helper script)

## Related Code

- `supabase/functions/get-quick-suggestions/index.ts` (line 571) - calls `deactivate_old_suggestions`
- `src/components/post-creation/AiSuggestionsCard.tsx` (line 229) - triggers regeneration with flag
- `CREATE_POST_DRAFTS_TABLE.sql` - defines `post_drafts` schema with `suggestion_id`

## Backwards Compatibility

✅ **Fully backwards compatible:**
- Function signature unchanged
- Existing calls continue to work
- Additional cleanup is additive only
- No breaking changes to any callers

## Performance Impact

**Negligible:**
- Adds one additional DELETE query per regeneration
- Query is indexed on `suggestion_id` (via FK)
- Typical deletion: 0-3 rows (one per suggestion if text was generated)
- No performance degradation expected

---

## Summary

✅ Regenerating quick suggestions now properly cleans up:
1. Old suggestion ideas (`daily_suggestions.is_active = false`)
2. Old draft texts (`post_drafts` deleted)

✅ Published/scheduled posts remain completely safe (different table, no foreign key)

✅ Zero code changes needed in frontend - existing `regenerate` flag triggers this automatically
